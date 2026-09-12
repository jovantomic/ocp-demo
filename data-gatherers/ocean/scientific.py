"""Bounded SDK acquisition and variable-wise NetCDF normalization; invoked by CLI."""
import datetime as dt
import itertools
import json
import math
import os
from pathlib import Path
import sys


def scalar(value):
    if hasattr(value, 'item'):
        # Keep datetime64 before .item() turns nanosecond dates into integers.
        if str(getattr(value, 'dtype', '')).startswith('datetime64'):
            return None if str(value) == 'NaT' else str(value) + 'Z'
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode('utf-8', errors='replace')
    return value if value is None or isinstance(value, (str, int, float, bool)) else str(value)


def normalize(ds, config, file, stream, remaining, provider):
    """Iterate each variable independently: avoid a cross-product of unrelated dimensions."""
    count = 0
    coord_names = config.get('coordinates', {})
    defaults = {'time': ['time', 'valid_time', 'TIME'], 'latitude': ['latitude', 'lat', 'LATITUDE'],
                'longitude': ['longitude', 'lon', 'LONGITUDE'], 'depth': ['depth', 'PRES']}
    for variable in config['variables']:
        if variable not in ds:
            raise ValueError(f'Missing configured variable {variable}')
        da = ds[variable]
        for indices in itertools.product(*(range(da.sizes[d]) for d in da.dims)):
            if count >= remaining:
                return count, True
            selection = dict(zip(da.dims, indices))
            value = scalar(da.isel(selection).values)
            coordinates = {}
            for logical, names in defaults.items():
                for name in [coord_names[logical]] if logical in coord_names else names:
                    if name in ds and set(ds[name].dims).issubset(selection):
                        coordinates[logical] = scalar(ds[name].isel({d: selection[d] for d in ds[name].dims}).values)
                        break
            original = {'variable': variable, 'indices': selection, 'coordinates': coordinates, 'value': value}
            lat, lon = coordinates.get('latitude'), coordinates.get('longitude')
            if isinstance(lon, (int, float)) and lon > 180:
                lon = (lon + 180) % 360 - 180
            geo = {'lat': lat, 'lon': lon} if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and abs(lat) <= 90 and abs(lon) <= 180 else None
            kind = config.get('kind', 'reanalysis' if provider == 'era5' else 'observation')
            flags = [f'sdk:{provider}']
            if kind == 'forecast':
                flags.append('model-output')
            qc_name = variable + '_QC'
            if qc_name in ds and set(ds[qc_name].dims).issubset(selection):
                qc = scalar(ds[qc_name].isel({d: selection[d] for d in ds[qc_name].dims}).values)
                flags.append(f'provider-qc:{qc}')
                original['qc'] = qc
            fields = {'entityId': f"{config.get('datasetId', config.get('shortName', provider))}:{lat}:{lon}:{coordinates.get('depth')}",
                      'metric': variable, 'value': value, 'unit': da.attrs.get('units'),
                      'observationStart': coordinates.get('time', ds.attrs.get('time_coverage_start')),
                      'observationEnd': coordinates.get('time', ds.attrs.get('time_coverage_end')),
                      'kind': kind, 'issueTime': config.get('issueTime'), 'location': geo,
                      'verticalCoordinate': coordinates.get('depth'), 'qualityFlags': flags,
                      'datasetVersion': config.get('datasetVersion', ds.attrs.get('product_version'))}
            stream.write(json.dumps({'file': str(file), 'original': original, 'fields': fields}, allow_nan=False) + '\n')
            count += 1
    return count, False


def main():
    provider, out_arg = sys.argv[1:]
    out = Path(out_arg).resolve()
    config = json.load(sys.stdin)
    import xarray as xr
    files = []
    warnings = []
    partial = False
    target = out / 'subset.nc'
    if provider == 'copernicus':
        import copernicusmarine
        # SDK downloads the original provider subset file before normalization.
        copernicusmarine.subset(dataset_id=config['datasetId'], variables=config['variables'],
            dataset_version=config.get('datasetVersion'), **config['subset'],
            output_directory=out, output_filename='subset.nc')
        files = [(target, 'provider-subset-netcdf')]
    elif provider == 'era5':
        import cdsapi
        client = cdsapi.Client(url='https://cds.climate.copernicus.eu/api', key=os.environ['CDSAPI_KEY'], quiet=True)
        client.retrieve(config['datasetId'], config['request']).download(str(target))
        files = [(target, 'provider-subset-netcdf')]
    elif provider == 'argo':
        from argopy import DataFetcher
        ds = DataFetcher(src=config.get('backend', 'erddap'), mode='expert', parallel=False).region(config['region']).to_xarray(errors='raise')
        ds.to_netcdf(target)
        files = [(target, 'sdk-materialized-netcdf')]
        warnings.append('Argo raw file is the SDK materialized dataset, not byte-identical original HTTP responses')
    elif provider == 'nasa-ocean':
        import earthaccess
        earthaccess.login(strategy='environment')
        cap = config.get('maxGranules', 1)
        query = dict(short_name=config['shortName'], temporal=(config['startDate'], config['endDate']), count=cap + 1)
        if config.get('boundingBox'):
            query['bounding_box'] = tuple(config['boundingBox'])
        if config.get('datasetVersion'):
            query['version'] = config['datasetVersion']
        results = earthaccess.search_data(**query)
        partial = len(results) > cap
        if results:
            files = [(Path(p).resolve(), 'provider-granule') for p in earthaccess.download(results[:cap], str(out), threads=1)]
        if not files:
            warnings.append('No matching NASA granules')
    else:
        raise ValueError('Unknown scientific provider')
    file_manifest = [{'path': str(f), 'origin': origin, 'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat()} for f, origin in files]
    limit = config.get('maxObservations', 10000)
    with (out / 'observations.jsonl').open('w') as stream:
        total = 0
        for file, _ in files:
            with xr.open_dataset(file, **config.get('openDataset', {})) as ds:
                # CMR bounds select intersecting granules, not pixels. Crop regular L3 grids too.
                if provider == 'nasa-ocean' and config.get('boundingBox'):
                    west, south, east, north = config['boundingBox']
                    for names, low, high in [(['lat', 'latitude'], south, north), (['lon', 'longitude'], west, east)]:
                        name = next((n for n in names if n in ds.coords and ds[n].ndim == 1), None)
                        if name is None:
                            raise ValueError('NASA boundingBox cropping requires a regular L3 latitude/longitude grid')
                        axis = ds[name]
                        if name in ['lon', 'longitude'] and float(axis.max()) > 180:
                            ds = ds.assign_coords({name: (axis + 180) % 360 - 180}).sortby(name)
                            axis = ds[name]
                        backwards = float(axis[0]) > float(axis[-1])
                        ds = ds.sel({name: slice(high, low) if backwards else slice(low, high)})
                count, capped = normalize(ds, config, file, stream, limit - total, provider)
                total += count
                partial = partial or capped
    (out / 'result.json').write_text(json.dumps({'files': file_manifest, 'partial': partial, 'warnings': warnings}))


if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print('OCP_MISSING_DEPENDENCY: install data-gatherers/requirements.txt', file=sys.stderr)
        sys.exit(2)
    except Exception as exc:
        # SDK exceptions may contain token-bearing URLs. Do not forward them to CLI logs.
        print('OCP_SCIENTIFIC_ERROR:' + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
