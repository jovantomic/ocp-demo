// OCP S1 / REV A / CONCEPT ONLY / dimensions in mm
// Open in OpenSCAD. F5 preview; F6 render; export selected part as STL.
// Sensor bodies are allocation envelopes. Threads are not modeled.
// Seal grooves, material and pressure rating require engineering validation.
$fn=96;
explode=0; // 0 assembled; 1 exploded
section=false;
part="assembly"; // assembly, body, top, bottom, guard, mount, electronics
OD=90; ID=82; body_length=210; flange_d=112; flange_h=12;
probe_xy=[[-22,-22],[22,-22],[22,22],[-22,22]];
module tube(od,id,h){difference(){cylinder(d=od,h=h);translate([0,0,-.1])cylinder(d=id,h=h+.2);}}
module bolt_holes(h){for(a=[45:90:315])rotate([0,0,a])translate([50,0,-.1])cylinder(d=4.5,h=h+.2);}
module spigot(){difference(){cylinder(d=81.6,h=13);for(z=[3,10])translate([0,0,z])rotate_extrude()translate([40,0])circle(r=1.2);}}
module cap(top=true){difference(){union(){cylinder(d=flange_d,h=flange_h);if(top)translate([0,0,-13])spigot();else translate([0,0,12])spigot();}bolt_holes(12);if(top)translate([0,0,-14])cylinder(d=12,h=28);else for(p=probe_xy)translate([p[0],p[1],-1])cylinder(d=18,h=28);}}
module body(){tube(OD,ID,body_length);}
module guard(){translate([0,0,-130])union(){tube(108,96,8);translate([0,0,108])tube(108,96,10);for(a=[0:45:315])rotate([0,0,a])translate([51,0,8])cylinder(d=5,h=100);}}
module mount(){difference(){union(){for(z=[42,165])translate([0,0,z])tube(98,90,14);for(z=[42,165])translate([-16,43,z])cube([32,17,14]);translate([-24,60,32])cube([48,6,160]);}for(z=[52,172])translate([0,59,z])rotate([-90,0,0])cylinder(d=7,h=9);}}
module electronics(){translate([-24,-1,30])cube([48,2,150]);for(z=[40,85,134])translate([-16,1,z])cube([32,10,22]);for(x=[-27,24])translate([x,-5,22])cube([3,10,164]);}
module assembly(){
 color("silver")body();
 color("lightgray")translate([0,0,210+explode*95])cap(true);
 color("lightgray")translate([0,0,-12-explode*60])cap(false);
 color("dimgray")translate([0,0,-explode*170])guard();
 color("gray")translate([0,explode*80,0])mount();
 color("seagreen")translate([explode*95,0,0])electronics();
 for(i=[0:3])let(p=probe_xy[i],r=[11,7,10,5][i],z=[-106,-112,-96,-88][i])color("silver")translate([p[0],p[1],z-explode*100])cylinder(r=r,h=-12-z);
 for(a=[45:90:315])rotate([0,0,a])color("gray")translate([50,0,-18])cylinder(d=4,h=244);
 color("dimgray")translate([0,0,222+explode*95])difference(){union(){cylinder(d=22,h=17,$fn=6);translate([0,0,17])cylinder(d=18,h=8);}cylinder(d=8,h=26);}
 color("black")translate([0,0,247+explode*95])cylinder(d=8,h=11);
 for(z=[3,10,200,207])color("black")translate([0,0,z])rotate_extrude()translate([40,0])circle(r=1.2);
}
module chosen(){if(part=="body")body();else if(part=="top")cap(true);else if(part=="bottom")cap(false);else if(part=="guard")guard();else if(part=="mount")mount();else if(part=="electronics")electronics();else assembly();}
if(section)difference(){chosen();translate([0,-200,-300])cube([250,400,800]);}else chosen();
