#!/usr/bin/env python3
"""Author the top-down Lavendyr region from its existing, save-stable maps.

Only the two outdoor region records are changed. --source may name an earlier
fixed-maps.json while iterating; other records always come from the live file.
This is an authoring command, not a runtime or a whole-world map generator.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / 'dist/fixed-maps.json'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path)
args = parser.parse_args()
maps = json.loads(FILE.read_text())
source = json.loads(args.source.read_text()) if args.source else maps
atlas = json.loads((ROOT / 'dist/assets/world-v05.json').read_text())
stable_forages = sorted(str((o['forage'] if isinstance(o['forage'],dict) else o).get('id') or o.get('id')) for a in maps.values() for o in a['objects'] if o.get('forage'))
stable_residents = sorted(r['id'] for a in maps.values() for r in a.get('residents',[]))
unchanged = {k: json.dumps(v, ensure_ascii=False, separators=(',', ':')) for k, v in maps.items() if k not in ('lavendyr', 'lavenderway')}
for key in ('lavendyr', 'lavenderway'):
    if source[key].get('regionVersion') == 18:
        raise SystemExit('Lavendyr region is already authored at v18; use --source with the v17 maps to re-author.')
    maps[key] = source[key]


def tile(rows, x, y):
    return rows[y][x] if 0 <= y < len(rows) and 0 <= x < len(rows[0]) else 'x'


def distance_segment(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((px-a[0])*dx+(py-a[1])*dy)/max(1, dx*dx+dy*dy)))
    return math.hypot(px-a[0]-t*dx, py-a[1]-t*dy)


def near_lane(x, y, lanes, margin):
    return any(distance_segment(x, y, a, b) < margin for lane in lanes for a, b in zip(lane, lane[1:]))


def paint_path(rows, points, width=32, material='d', preserve_water=True):
    radius = width / 2
    for a, b in zip(points, points[1:]):
        for ty in range(max(0, int((min(a[1],b[1])-radius)/16)), min(len(rows), int((max(a[1],b[1])+radius)/16)+1)):
            for tx in range(max(0, int((min(a[0],b[0])-radius)/16)), min(len(rows[0]), int((max(a[0],b[0])+radius)/16)+1)):
                if distance_segment(tx*16+8,ty*16+8,a,b) <= radius:
                    if not preserve_water or tile(rows,tx,ty) not in 'wb':
                        rows[ty][tx] = material


def ellipse(rows, x, y, rx, ry, material='c', only=None):
    for ty in range(max(0,int((y-ry)/16)), min(len(rows),int((y+ry)/16)+1)):
        for tx in range(max(0,int((x-rx)/16)), min(len(rows[0]),int((x+rx)/16)+1)):
            if ((tx*16+8-x)/rx)**2+((ty*16+8-y)/ry)**2 <= 1 and (only is None or rows[ty][tx] in only):
                rows[ty][tx] = material


def prop(area, name, sprite, x, y, *, hit=None, **extra):
    assert sprite in atlas, sprite
    obj = {'id': area['id']+'_v18_'+name, 'sprite':sprite, 'x':x, 'y':y, 'scale':1, 'placement':'lavendyr-region', 'regionVersion':18, **extra}
    if hit: obj['hit'] = hit
    area['objects'].append(obj)
    return obj


def boundary(area,o):
    return o['x'] < 64 or o['x'] > area['w']*16-64 or o['y'] < 100 or o['y'] > area['h']*16-64 or o.get('boundaryCap') or str(o.get('id','')).startswith('audit_v11_')


def clear_wood(area, lanes=(), rectangles=(), circles=()):
    def clear(o):
        if not o['sprite'].startswith(('tree','bush')) or boundary(area,o): return False
        x,y=o['x'],o['y']
        return near_lane(x,y,lanes,30) or any(ax<=x<=bx and ay<=y<=by for ax,ay,bx,by in rectangles) or any(math.hypot(x-cx,y-cy)<r for cx,cy,r in circles)
    area['objects']=[o for o in area['objects'] if not clear(o)]


def field(area, rows, name, bounds, lanes=(), spacing=28, palette=('flora_purple',)):
    ax,ay,bx,by=bounds
    for y in range(ay,by+1,spacing):
        for x in range(ax,bx+1,24):
            if tile(rows,x//16,y//16) != 'g' or near_lane(x,y,lanes,28): continue
            if any(math.hypot(x-o['x'],y-o['y'])<23 for o in area['objects'] if o.get('hit') or o.get('forage')): continue
            rows[y//16][x//16]='f'
            prop(area,name+'_'+str(x)+'_'+str(y),palette[(x//24+y//spacing)%len(palette)],x,y,label=None,placement='medicinal-field')


def bluebells(area, rows, boxes, lanes):
    for i,(ax,ay,bx,by) in enumerate(boxes):
        for y in range(ay,by,27):
            for x in range(ax,bx,31):
                if tile(rows,x//16,y//16)!='g' or near_lane(x,y,lanes,26): continue
                if any(math.hypot(x-o['x'],y-o['y'])<18 for o in area['objects'] if o.get('hit')): continue
                prop(area,'bluebell_'+str(i)+'_'+str(x)+'_'+str(y),'flora_blue' if (x+y)%3 else 'flora_white',x,y,placement='bluebell-understory')


def fence_run(area, name, a, b, style='fence_h'):
    length=math.hypot(b[0]-a[0],b[1]-a[1]);step=32 if style=='fence_h' else 26
    for i in range(max(1,round(length/step))):
        t=(i+.5)/max(1,round(length/step));x=round(a[0]+(b[0]-a[0])*t);y=round(a[1]+(b[1]-a[1])*t)
        # Low field rails are continuous, with authored gaps on their access side.
        hit=[x-16,y-7,32,5] if style=='fence_h' else [x-4,y-25,7,26]
        prop(area,name+'_'+str(i),style,x,y,hit=hit,placement='field-enclosure')


# Lavendyr Glade: public well court, a glass conservatory, drying court and
# stream-side bluebell walks frame the eight retained cottage frontages.
town=maps['lavendyr'];rows=[list(r) for r in town['tiles']]
town_lanes=[[[8,440],[152,440],[320,448],[440,448],[480,464],[576,464],[624,464],[736,464],[816,432],[816,408],[944,408],[992,440],[1016,440]],
 [[184,440],[184,304],[272,304],[352,256],[352,240]],
 [[624,464],[608,416],[608,304],[624,256],[704,256]],
 [[832,408],[832,352],[928,352]],
 [[784,608],[808,592],[896,592],[928,608]]]
# Replace the over-wide central strip with a readable village street, retaining
# all door spurs, garden beds, gates and resident routes.
for y in (26,27,28,29):
    for x in range(town['w']):
        if rows[y][x]=='d' and (y in (26,29)) and 3<x<town['w']-4: rows[y][x]='g'
for lane in town_lanes: paint_path(rows,lane,32)
ellipse(rows,528,464,91,66,'c',only='gdc')
# The conservatory sits behind the herbalists' court; it does not replace an
# established home or change its physical door/return coordinates.
clear_wood(town,town_lanes,[(624,112,800,272),(896,112,944,696)],[(528,464,94)])
town['objects']=[o for o in town['objects'] if not (o['sprite'] in ('flora_white','port_cargo_sack') and 652<=o['x']<=768 and 128<=o['y']<=224)]
for y in range(8,15):
    for x in range(40,48):
        if rows[y][x] in 'fd':rows[y][x]='g'
prop(town,'conservatory','lv18_conservatory',704,224,hit=[664,199,80,20],label='Lavendyr glass conservatory',campaignLandmark='conservatory')
paint_path(rows,[[624,256],[704,256],[784,256]],32,'c')
for x in (640,672,704,736,768):
    prop(town,'conservatory_sage_'+str(x),'flora_white',x,240,placement='medicinal-court')
for s in town.get('workstations',[]):
    if 664<=s['x']<=760 and 128<=s['y']<=224:
        x=min((640,672,704,736,768),key=lambda n:abs(n-s['x']));s.update(x=x,y=256,target=[x,240],label='Conservatory medicinal beds')
# A secluded stream follows the east garden boundary, with broad safe crossings
# on both the village street and quiet footpaths.
for y in range(7,44):
    x=57 if y<24 else 58 if y<33 else 57
    for dx in range(2):rows[y][x+dx]='w'
for ay,by in ((21,22),(24,26),(37,39)):
    for y in range(ay,by+1):
        for x in range(56,61): rows[y][x]='b'
for j,y in enumerate((350,382,590,654)):
    for x in (900,960):prop(town,'stream_post_'+str(j)+'_'+str(x),'estate_gatepost',x,y,hit=[x-5,y-9,10,8],placement='stream-footbridge')
# Bridges are part of the connected walking lanes; water never covers a home,
# stable NPC start or established doorway.
field(town,rows,'conservatory_bed',(624,144,624,208),town_lanes,32,('flora_purple','flora_white'))
field(town,rows,'east_medicinal',(768,136,800,200),town_lanes,32,('flora_purple','flora_blue'))
field(town,rows,'weaver_thyme',(576,552,624,608),town_lanes,28,('flora_purple','flora_white'))
bluebells(town,rows,[(272,144,368,232),(624,560,688,640),(864,128,900,208),(832,640,896,696)],town_lanes)
# Replace each cottage silhouette while keeping its established physical portal.
for i,house in enumerate(o for o in town['objects'] if o['sprite'].startswith('town_house_')):
    old=atlas[house['sprite']];door_x=house['x']+old.get('doorOffset',0)
    variant='drying' if 'Drying House' in house.get('label','') else ('herbal' if i%2==0 else 'weaver')
    house['sprite']='town_house_lavendyr_v18_'+variant
    house['x']=door_x-atlas[house['sprite']].get('doorOffset',0)
    width=max(32,atlas[house['sprite']]['rect'][2]-14)
    house['hit']=[round(house['x']-width/2),house['y']-27,width,22]
    house['regionVersion']=18
for o in town['objects']:
    if o['sprite']=='town_well':o['sprite']='lv18_well';o['regionVersion']=18
# A lavender-roofed herb seller has a purposeful public trading pocket.
prop(town,'herb_market_stall','lv18_herb_stall',352,488,hit=[332,474,40,10],label='Lavendyr herb and remedy stall',placement='herb-market-court')
# Real drying equipment, packed herb bundles and a small timber work table form
# a coherent yard beside the existing drying house, away from porter routes.
for i,x in enumerate((832,864,896)):
    prop(town,'drying_rack_'+str(i),'port_fish_drying_rack',x,528,hit=[x-7,519,14,6],label='Medicinal herbs on the drying rails',placement='herb-drying-court')
for i,x in enumerate((832,864,896)):
    prop(town,'drying_herbs_'+str(i),'flora_purple',x,516,placement='herb-drying-court')
# Keep the current well footprint and NPC neighbourhood while giving the court
# a deliberate radial floral border and seating pockets.
for i,(x,y) in enumerate(((448,432),(464,544),(608,448),(624,496))):
    prop(town,'court_border_'+str(i),'flora_purple',x,y,placement='well-court-border')
town['tiles']=[''.join(r) for r in rows]
town['regionVersion']=18
town['walkLanes']=town_lanes
town['questLandmarks']={'conservatory':{'x':704,'y':256},'herbCourt':{'x':504,'y':320},'stoneWell':{'x':528,'y':464},'dryingCourt':{'x':864,'y':552},'streamFootbridge':{'x':928,'y':352},'briarvaultApproach':{'x':352,'y':240}}
town['districts']=[{'name':'Growers’ Stone Well Court','kind':'public-court','at':[528,464]},
 {'name':'Medicinal Gardens and Glass Conservatory','kind':'cultivation','at':[704,224]},
 {'name':'Cottage lanes','kind':'residential','buildings':[p['target'] for p in town['portals'] if p.get('kind')=='door']},
 {'name':'Herb-drying Court','kind':'work','at':[864,528]}, {'name':'Bluebell Stream Walk','kind':'garden-walk','at':[928,352]}]
town['designIntent']='Lavender and bluebell herbalist village: a central stone well, glass conservatory, medicinal beds, cottage lanes, drying courts and secluded stream footbridges.'

# Lavenderway Fields: a cultivated approach gradually becomes a ruined garden.
road=maps['lavenderway'];rows=[list(r) for r in road['tiles']]
road['tilePalette'].update(c='town_square_lavendyr',f='dirt_clean',b='cobble_grey')
main=[[x*16+8,y*16+8] for x,y in road['waypoints']];main[0]=[8,360];main[-1]=[2296,360]
# Existing save-stable camp IDs and species stay in their same regional order.
# The fourth clearing now guards the greenhouse approach, as in the road atlas.
road['camps'][3].update(x=1960,y=344,side='north',spawnPoints=[[1936,366],[1984,366],[1960,386]])
clearing_names=['Lavender-hedge fork','Damaged drying-shed clearing','Stream-bank bramble terrace','Hidden greenhouse approach']
regional_roster=['lavender_imp','violet_brambleback','amethyst_wisp','lavender_imp']
regional_camp_names=['Lavender Imp Den','Brambleback Hollow','Amethyst Wisp Grove','Thornbound Garden Camp']
for c,name,regional_monster,camp_name in zip(road['camps'],clearing_names,regional_roster,regional_camp_names):
    c['siteName']=name
    c['regionalMonster']=regional_monster
    c['name']=camp_name
    c['clearedLandmark']={'camp-1':'The lavender hedges are quiet; the first fork is safe.', 'camp-2':'The drying court is open to returning herb growers.', 'camp-3':'Bluebells return to the old bridge terrace.', 'camp-4':'The way to the hidden greenhouse and stone garden is clear.'}[c['id']]
# Strip only the old road surface, then lay a narrow lane between the retained
# forests. Clearings remain visibly wider and are connected by side approaches.
for y,row in enumerate(rows):
    for x,ch in enumerate(row):
        if ch in 'dc' and 3<x<road['w']-4:rows[y][x]='g'
paint_path(rows,main,44)
# Retain comfortable, exact travel gate mouths on both ends.
for y in range(20,25):
    for x in (*range(0,4),*range(140,144)): rows[y][x]='d'
branches=[[[424,360],[424,304],[424,288]], [[712,304],[760,368],[784,448],[784,488],[736,488],[768,536]],
 [[1464,472],[1464,408],[1464,384]], [[1640,432],[1640,336],[1632,288]],
 [[1840,424],[1840,304],[1840,272]], [[1888,408],[1920,384],[2016,384],[2064,320],[2112,288]],
 [[424,304],[480,272],[480,240]], [[1840,304],[1904,288],[1936,312]]]
for lane in branches:paint_path(rows,lane,32)
for c in road['camps']:ellipse(rows,c['x'],c['y']+10,65,50,'d',only='gdcf')
# The stone garden is intentionally off the through road; the circular shape,
# broken walls and open southern gate make its final approach readable.
ellipse(rows,2112,176,116,102,'d',only='gdc')
ellipse(rows,2112,176,94,82,'c',only='gdc')
ellipse(rows,2112,176,44,38,'d',only='gdc')
paint_path(rows,[[2112,288],[2112,240]],40,'c')
features=[(144,192,352,288),(192,416,480,480),(480,128,800,208),(544,488,848,608),
 (1040,144,1344,224),(1008,512,1280,608),(1520,128,1712,224),(1520,480,1776,576),(1760,128,1904,208),(1856,496,2192,608)]
clear_wood(road,[main,*branches],features,[(2112,176,142),(1840,240,94),*( (c['x'],c['y']+12,80) for c in road['camps'])])
# Remove a decorative rock from the new garden; all boundary caps and all
# established forage objects remain exactly identified and harvestable.
road['objects']=[o for o in road['objects'] if not(o['sprite']=='rock2' and 1980<o['x']<2180 and 100<o['y']<300)]
for i,bounds in enumerate(features):field(road,rows,'lavender_rows_'+str(i),bounds,[main,*branches],28,('flora_purple','flora_purple','flora_blue'))
bluebells(road,rows,[(128,128,352,192),(1040,240,1168,288),(1360,112,1520,192),(1696,272,1776,352),(1776,544,1840,608)],[main,*branches])
# The existing stream crossing becomes a stone bridge, still using the exact
# passable water/bridge terrain. Broken stone rails stand beyond its walk lane.
for y in range(16,21):
    for x in range(56,61):rows[y][x]='b'
for i,x in enumerate((888,920,952,984)):
    for y in (264,344):prop(road,'bridge_rail_'+str(i)+'_'+str(y),'estate_wall_h',x,y,hit=[x-16,y-7,32,5],campaignLandmark='streamBridge',label='Repairable old stream bridge',placement='stone-bridge')
# The southern bridge interaction site sits beside its rail, not inside water.
rows[21][56]='c'
prop(road,'abandoned_wagon','lv18_wagon',352,320,hit=[328,305,48,11],label='Abandoned apothecary wagon',campaignLandmark='wagon',placement='roadside-story')
prop(road,'wagon_crates','port_crate_stack',320,328,hit=[314,315,12,8],label='Weathered apothecary crates',placement='roadside-story')
prop(road,'damaged_drying_shed','lv18_drying_house',736,472,hit=[716,455,40,13],label='Damaged herb-drying shed',campaignLandmark='dryingShed',placement='roadside-story')
prop(road,'shed_ruins','camp_ruins',704,500,label='Broken timber and spilled herb bundles',campaignLandmark='dryingShed',restoredSprite='flowerpot2',placement='roadside-story')
for i,x in enumerate((816,848)):
    prop(road,'road_drying_rack_'+str(i),'port_fish_drying_rack',x,488,hit=[x-7,479,14,6],label='Torn herb-drying rails',campaignLandmark='dryingShed',placement='roadside-story')
    prop(road,'road_drying_bundle_'+str(i),'flora_purple',x,477,placement='roadside-story')
prop(road,'hidden_greenhouse','lv18_ruined_greenhouse',1840,256,hit=[1800,233,80,19],label='Abandoned hidden greenhouse',campaignLandmark='greenhouse',restoredSprite='lv18_conservatory',placement='roadside-story')
for i,(x,y) in enumerate(((1784,240),(1896,224),(1784,272),(1896,256))):prop(road,'greenhouse_brambles_'+str(i),'flora_purple',x,y,placement='petrified-garden')
# Stone garden fragments leave an open southern entrance and broad circular
# interior; no reused creature art is added by this regional scenery pass.
for i,angle in enumerate(range(0,360,30)):
    if 45<angle<135:continue
    x=round(2112+112*math.cos(math.radians(angle)));y=round(176+96*math.sin(math.radians(angle)))
    prop(road,'garden_column_'+str(i),'estate_gatepost',x,y,hit=[x-5,y-9,10,8],label='Ruined garden column',placement='circular-garden')
    prop(road,'garden_vines_'+str(i),'flora_purple',x+8,y-14,placement='petrified-garden')
for i,(x,y) in enumerate(((2040,128),(2080,112),(2144,112),(2184,128),(2024,192),(2200,192))):prop(road,'garden_flower_'+str(i),'flora_white' if i%2 else 'flora_blue_bush',x,y,placement='petrified-garden')
# Short field fences frame cultivation without sealing any camp/fruit access.
for i,(a,b) in enumerate((([192,488],[352,488]),([512,216],[672,216]),([1040,232],[1200,232]),([1552,584],[1712,584]),([1920,616],[2080,616]))):
    if not near_lane((a[0]+b[0])/2,a[1],[main,*branches],44):fence_run(road,'field_rail_'+str(i),a,b)
# Remedy beds are real authored places. The campaign owns their one-time herb
# rewards, avoiding new/renamed entries in the established 109-source forage set.
landmarks={'remedySage':{'x':480,'y':240},'remedyRosemary':{'x':768,'y':536},'remedyThyme':{'x':1632,'y':288},'greenhouse':{'x':1840,'y':272},'dryingShed':{'x':736,'y':488},'streamBridge':{'x':904,'y':336},'arenaApproach':{'x':2112,'y':288}}
for i,key in enumerate(('remedySage','remedyRosemary','remedyThyme')):
    p=landmarks[key]
    for j,dx in enumerate((-24,0,24)):prop(road,key+'_'+str(j),('flora_white','flora_purple','flora_blue')[i],p['x']+dx,p['y']-16,label=('Sage','Rosemary','Creeping thyme')[i]+' remedy bed' if j==1 else None,campaignLandmark=key,placement='remedy-gathering')
road['tiles']=[''.join(r) for r in rows]
road['regionVersion']=18
road['walkLanes']=[main,*branches]
road['questLandmarks']=landmarks
road['questLandmarks']['herbs']=[{'id':'lavenderway_remedy_sage',**landmarks['remedySage']},{'id':'lavenderway_remedy_rosemary',**landmarks['remedyRosemary']},{'id':'lavenderway_remedy_thyme',**landmarks['remedyThyme']}]
road['landmarks']=[{'name':'Abandoned Apothecary Wagon','kind':'wagon','at':[352,320]}, {'name':'Damaged Herb-drying Shed','kind':'drying-shed','at':[736,488]}, {'name':'Old Stone Stream Bridge','kind':'bridge','at':[936,304]}, {'name':'Hidden Glass Greenhouse','kind':'greenhouse','at':[1840,256]}, {'name':'Medusa’s Circular Stone Garden','kind':'guardian-approach','at':[2112,176]}]
road['pathStyle']='Narrow winding lane with four wider connected roadside clearings; lavender hedge forks, a drying court, old stream bridge and an optional stone-garden branch.'
road['geography']='Lavender fields and bluebell birch margins give way to a hidden greenhouse and petrified circular garden.'
road['designIntent']='Top-down adaptation of the Lavenderway road atlas: medicinal cultivation, four distinct camp sites, abandoned apothecary wagon, drying shed, stream crossing, hidden greenhouse and ruined circular garden.'
# White-barked birches frame the fields and quiet lanes; the established dense
# forest boundary and every physical trunk collider stay intact.
for area in (town,road):
    trees=[o for o in area['objects'] if o['sprite'].startswith('tree') and not boundary(area,o)]
    for i,o in enumerate(trees):
        if o['sprite']=='tree0' or i%5==0:
            o['sprite']='lv18_birch';o['regionVersion']=18;o['placement']='birch-margin'
# Preserve every identity used by imported saves and all non-regional records.
for key,serial in unchanged.items():assert json.dumps(maps[key],ensure_ascii=False,separators=(',',':'))==serial,key+' changed outside Lavendyr scope'
for key in ('lavendyr','lavenderway'):
    before=source[key];after=maps[key]
    # The original source objects are mutated in place, but stable forage IDs
    # are independently checked against the published world count below.
    assert len(after['tiles'])==after['h'] and all(len(r)==after['w'] for r in after['tiles'])
assert stable_forages==sorted(str((o['forage'] if isinstance(o['forage'],dict) else o).get('id') or o.get('id')) for a in maps.values() for o in a['objects'] if o.get('forage'))
assert stable_residents==sorted(r['id'] for a in maps.values() for r in a.get('residents',[]))
assert sum(bool(o.get('forage')) for a in maps.values() for o in a['objects'])==109
assert sum(len(a.get('residents',[])) for a in maps.values() if a['kind']=='town')==104
assert [c['id'] for c in road['camps']]==['camp-1','camp-2','camp-3','camp-4']
assert town['reservedQuestSites']=={'gardenEntrance':[352,224],'closedFlowers':[504,320]}
FILE.write_text(json.dumps(maps,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'authored':['lavendyr','lavenderway'],'regionVersion':18,'landmarks':landmarks,'otherAreasUnchanged':len(unchanged),'forage':109,'townResidents':104},ensure_ascii=False))
