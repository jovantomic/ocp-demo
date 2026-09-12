# OCP S1 — mechanical concept, revision A

Parametric concept for a cabled submerged water-quality node at a fish farm. Units: millimetres. Created 2026-09-12.

## Deliverables

- `ocp-s1.scad`: editable OpenSCAD constructive-solid-geometry source. Set `part`, `explode` and `section` to select a part or view. Render before exporting an STL.
- `ocp-s1-assembly.obj`: tessellated, named component envelopes for import into a 3D application. Units are mm; OBJ does not encode units.
- `ocp-s1-drawing.svg`: scalable A3 general arrangement with front elevation, section, port layout, dimensions and assembly index. Print at fit-to-page; sheet is explicitly NTS.
- `ocp-s1-mechanical.html`: interactive inline preview with rotation, exploded view, housing cutaway and component isolation.
- `index.html`: standalone offline version of the same viewer.
- `build_model.py`, `viewer.template.html`: reproducible preview geometry and drawing generator. Run `python3 build_model.py`.

## Geometry and intended construction

Tube Ø90 OD, Ø82 ID, 210 long; cap flanges Ø112 × 12. Four external M4 tie rods retain the caps. Overall modeled cable-end-to-cage height is 388. Cable continues to an above-water controller and antenna; that enclosure is outside this assembly.

Four sensor positions at (±22, ±22), with provisional Ø18 through-holes in the CAD bulkhead. Oxygen, pH, conductivity and temperature probes are allocation envelopes, not vendor-specific mechanical models. Each needs an independently sealed adapter matched to the selected sensor; those adapters are not production-designed. Outer cage Ø108, with eight ribs, leaves the measuring tips exposed to flow and accessible for cleaning.

Candidate construction is a corrosion-compatible metal housing and serviceable polymer cage, with material selection finalized for the actual water chemistry. The mounting geometry is an allocation for a rear plate and two collars, not a validated clamp mechanism.

## Engineering status

This is a layout model, not a fabrication release. No pressure rating, FEA, tolerance stack, fastener preload or waterproofness has been verified. Seal-groove dimensions are illustrative and require supplier-specific gland design, squeeze, extrusion-gap and tolerance checks. Threads and electronic wiring are not modeled. The sensor measurement volume, calibration access, fouling maintenance and strain relief require confirmation with actual parts.

The OBJ/viewer use simplified component envelopes; the OpenSCAD source adds actual bulkhead through-holes and mounting holes. Viewer seal rings are simplified annular bands. OpenSCAD has not been rendered in this environment because the application is unavailable. The housing cutaway in the viewer is an inspection visibility filter; use the CAD `section` setting for a Boolean section.

Before making functional hardware: choose exact sensors and adapters, finalize cable gland and seals, resolve corrosion and clamp retention, specify tolerances, render and inspect CAD interference, then bench-test and pressure-test an empty enclosure for the intended service depth. A printed model can communicate assembly and packaging but is not a qualified underwater enclosure.
