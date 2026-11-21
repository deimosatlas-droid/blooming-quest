#!/usr/bin/env python3
"""Author the rich, road-only Lavenderway landscape pass over the v18 region.

The completed town and every other map remain byte-equivalent. Camps, campaign
sites, plants, portals and exits are not moved. --source allows a review baseline
for deterministic re-authoring without rolling back another map's current data.
"""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MAP_FILE=ROOT/'dist/fixed-maps.json'
args_parser=argparse.ArgumentParser(description=__doc__)
args_parser.add_argument('--source',type=Path)
args=args_parser.parse_args()
maps=json.loads(MAP_FILE.read_text())
baseline=json.loads(args.source.read_text()) if args.source else maps
road=copy.deepcopy(baseline['lavenderway'])
if road.get('detailVersion')==18:
    raise SystemExit('Road already detailed; use --source with its prior v18 review baseline to re-author.')
atlas=json.loads((ROOT/'dist/assets/world-v05.json').read_text())
required=['lavender_patch','bluebell_meadow','fern_bed','bloom_bush','flowering_tree','birch_cluster','flower_rock','lavender_bed','ruin_wall','ruin_column','cliff_ledge','waterfall','moss_grass','pale_cobble','worn_path','lavender_soil']
missing=['lv18_'+key for key in required if 'lv18_'+key not in atlas]
if missing:raise SystemExit('The Lavenderway nature atlas must be prepared first: '+', '.join(missing))
unchanged={key:json.dumps(area,ensure_ascii=False,separators=(',',':')) for key,area in maps.items() if key!='lavenderway'}
retained={key:copy.deepcopy(road.get(key)) for key in ('camps','questLandmarks','walkLanes','portals','exits','spawn','waypoints','safe','kind')}
forage_before=[copy.deepcopy(o) for o in road['objects'] if o.get('forage')]
rows=[list(row) for row in road['tiles']]
lanes=road['walkLanes']
plants=[o for o in road['objects'] if o.get('forage')]
quest_points=[(point['x'],point['y']) for point in road['questLandmarks'].values() if isinstance(point,dict) and 'x' in point]
camps=road['camps']


def dist_seg(px,py,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((px-a[0])*dx+(py-a[1])*dy)/max(1,dx*dx+dy*dy)))
    return math.hypot(px-a[0]-t*dx,py-a[1]-t*dy)


def lane_distance(x,y):return min(dist_seg(x,y,a,b) for lane in lanes for a,b in zip(lane,lane[1:]))


def tile(x,y):return rows[int(y//16)][int(x//16)] if 0<=x<road['w']*16 and 0<=y<road['h']*16 else 'x'


def jitter(x,y,salt=0):
    n=(int(x)*374761393+int(y)*668265263+salt*1442695041)&0xffffffff;n=((n^(n>>13))*1274126177)&0xffffffff
    return (n^(n>>16))/4294967295


def protected(x,y,margin=38,forage_margin=43,camp_margin=76):
    return lane_distance(x,y)<margin or any(math.hypot(x-p['x'],y-p['y'])<forage_margin for p in plants) or any(math.hypot(x-px,y-py)<28 for px,py in quest_points) or any(((x-c['x'])/camp_margin)**2+((y-c['y']-8)/(camp_margin*.78))**2<1 for c in camps)


def prop(name,sprite,x,y,*,hit=None,**extra):
    assert sprite in atlas,sprite
    low=sprite in ('lv18_lavender_patch','lv18_lavender_bed','lv18_bluebell_meadow','lv18_fern_bed')
    if low:extra.setdefault('groundDetail',True)
    if sprite in ('lv18_lavender_patch','lv18_lavender_bed'):extra.setdefault('scale',1.35)
    obj={'id':'lavenderway_detail18_'+name,'sprite':sprite,'x':round(x),'y':round(y),'scale':1,'placement':'lavenderway-detail','detailVersion':18,**extra}
    if hit:obj['hit']=[round(v) for v in hit]
    road['objects'].append(obj);return obj


def canopy_clear(x,y,sprite):
    art=atlas[sprite];left=x-art['anchor'][0];top=y-art['anchor'][1];right=left+art['rect'][2];bottom=top+art['rect'][3]
    for lane in lanes:
        for a,b in zip(lane,lane[1:]):
            steps=max(1,math.ceil(math.hypot(b[0]-a[0],b[1]-a[1])/12))
            for i in range(steps+1):
                px=a[0]+(b[0]-a[0])*i/steps;py=a[1]+(b[1]-a[1])*i/steps
                if left-18<px<right+18 and top-18<py<bottom+18:return False
    return True


def is_boundary(obj):
    return obj['x']<64 or obj['x']>road['w']*16-64 or obj['y']<100 or obj['y']>road['h']*16-64 or obj.get('boundaryCap') or str(obj.get('id','')).startswith('audit_v11_')


def ground_ellipse(cx,cy,rx,ry,material,allowed='gfdc'):
    for y in range(max(0,int((cy-ry)/16)),min(road['h'],int((cy+ry)/16)+1)):
        for x in range(max(0,int((cx-rx)/16)),min(road['w'],int((cx+rx)/16)+1)):
            px,py=x*16+8,y*16+8
            if ((px-cx)/rx)**2+((py-cy)/ry)**2<=1 and rows[y][x] in allowed:rows[y][x]=material

# Warm cream paths and fresh mossy ground establish the reference palette before
# any flowers are drawn. Bridge terrain remains b and physically unchanged.
road['tilePalette'].update(g='lv18_moss_grass',d='lv18_pale_cobble',c='lv18_pale_cobble',f='lv18_lavender_soil',b='lv18_pale_cobble')
# Replace the previous tiny regular rows with broad hand-shaped flowering masses.
road['objects']=[o for o in road['objects'] if o.get('placement') not in ('medicinal-field','bluebell-understory')]
for row in rows:
    for i,ch in enumerate(row):
        if ch=='f':row[i]='g'

# Four broad, clear combat lawns remain readable amid the denser fields.
for camp in camps:
    ground_ellipse(camp['x'],camp['y']+10,83,64,'g')
    ground_ellipse(camp['x'],camp['y']+10,62,44,'d')
# Do not alter the approaches, only their grass-facing planting shoulders.
field_islands=[
 (235,224,118,72),(224,464,132,47),(478,176,103,48),(650,164,148,51),
 (586,524,94,56),(765,564,83,47),(1112,168,116,57),(1280,200,101,58),
 (1104,554,86,52),(1256,586,87,34),(1512,160,85,45),(1680,168,107,60),
 (1576,536,106,55),(1760,560,109,52),(1832,156,74,36),
 (1984,548,135,64),(2176,536,61,52),(1768,332,58,52),(2168,296,58,38)]
field_bounds=[]
for index,(cx,cy,rx,ry) in enumerate(field_islands):
    field_bounds.append((cx-rx-34,cy-ry-18,cx+rx+34,cy+ry+20))
# Retain the connected forest wall. Interior shrubs can recede behind the new
# fields; fruit trunks and every saved plant record are preserved verbatim.
def remove_for_fields(o):
    if o.get('forage') or is_boundary(o):return False
    if not(o['sprite'].startswith(('tree','bush')) or o['sprite']=='lv18_birch'):return False
    return any(ax<o['x']<bx and ay<o['y']<by for ax,ay,bx,by in field_bounds)
road['objects']=[o for o in road['objects'] if not remove_for_fields(o)]

# Each island has curved, overlapping lavender ribbons and irregular end caps.
# The wide assets carry dense purple/white detail instead of a sparse dot grid.
counts={'lavender':0,'meadow':0,'canopy':0,'ruins':0,'water':0}
for index,(cx,cy,rx,ry) in enumerate(field_islands):
    for band in range(-2,3):
        yy=cy+band*23
        if abs(yy-cy)>ry:continue
        half=rx*math.sqrt(max(0,1-((yy-cy)/ry)**2))
        start=cx-half+12
        for slot in range(max(1,int((half*2-16)/43))):
            x=start+slot*43+(jitter(index,slot,band+7)-.5)*15
            y=yy+math.sin((x-cx)/64+index)*7+(jitter(slot,index,8)-.5)*7
            if tile(x,y)!='g' or protected(x,y,47,48,89):continue
            sprite='lv18_lavender_bed' if (slot+band+index)%4==0 else 'lv18_lavender_patch'
            prop('lavender_'+str(index)+'_'+str(band)+'_'+str(slot),sprite,x,y,placement='layered-lavender-field',fieldId='lavenderway_field_'+str(index))
            ground_ellipse(x,y,29,12,'f',allowed='g')
            counts['lavender']+=1
    # Ragged outer flowers soften the cultivated rows into wild meadow.
    for side in (-1,1):
        x=cx+side*(rx*.78);y=cy+ry*.78
        if tile(x,y)=='g' and not protected(x,y,43,45,87):
            prop('field_fringe_'+str(index)+'_'+str(side),'lv18_bluebell_meadow',x,y,placement='wildflower-fringe');counts['meadow']+=1

# Blue-white flower carpets nestle between cultivated fields and the pale road.
meadow_islands=[(152,160),(320,160),(496,256),(592,224),(816,192),(528,584),(824,520),
 (1056,240),(1200,248),(1360,208),(1096,512),(1304,552),(1432,216),(1680,256),
 (1560,312),(1712,384),(1816,592),(1888,512),(2120,608),(2184,464),(1984,240),(2240,240)]
for i,(cx,cy) in enumerate(meadow_islands):
    for j,(dx,dy) in enumerate(((-17,-8),(18,10))):
        x,y=cx+dx,cy+dy
        if tile(x,y)=='g' and not protected(x,y,35,43,82):
            prop('bluebells_'+str(i)+'_'+str(j),'lv18_bluebell_meadow',x,y,placement='blue-white-meadow');counts['meadow']+=1

# Pink flowering crowns and clusters of pale birches give each roadside glade
# its own silhouette. Their real small trunk footprints stay off walking lanes.
canopy_spots=[(144,160),(344,128),(528,128),(808,136),(128,424),(472,576),(816,608),
 (1040,144),(1200,128),(1360,160),(1056,568),(1336,584),(1440,128),(1696,128),
 (1760,232),(1520,592),(1816,576),(2000,144),(2240,192),(2192,608),(2080,600)]
for i,(x,y) in enumerate(canopy_spots):
    if tile(x,y)!='g' or protected(x,y,62,65,100):continue
    sprite='lv18_birch_cluster' if i%3==0 else 'lv18_flowering_tree'
    if not canopy_clear(x,y,sprite):continue
    hit=[x-15,y-11,30,9] if i%3==0 else [x-8,y-11,16,9]
    prop('canopy_'+str(i),sprite,x,y,hit=hit,placement='flowering-woodland-margin');counts['canopy']+=1
# Change selected existing inner woodland crowns while retaining their collider
# and all dense outer edge trees. This keeps new colour naturally interleaved.
for i,o in enumerate(road['objects']):
    if o['sprite'] in ('tree0','tree1','tree_spring0') and not is_boundary(o) and i%4==0 and not protected(o['x'],o['y'],56,58,94) and canopy_clear(o['x'],o['y'],'lv18_flowering_tree'):
        o['sprite']='lv18_flowering_tree';o['placement']='flowering-woodland-margin';o['detailVersion']=18;counts['canopy']+=1

# Leafy ferns, rose-blue bushes and flower-crowned stones make layered field
# edges. They are shallow foreground accents rather than obstructions on lanes.
edge_spots=[(104,224),(176,288),(312,304),(520,208),(600,112),(832,208),(144,496),(384,496),(520,608),(832,584),
 (1032,192),(1120,112),(1296,264),(1328,224),(1056,608),(1264,624),(1456,112),(1728,208),(1744,288),(1760,392),
 (1520,496),(1696,616),(1840,576),(1936,472),(2112,496),(2208,576),(2224,280),(2016,224)]
for i,(x,y) in enumerate(edge_spots):
    if tile(x,y)!='g' or protected(x,y,33,44,84):continue
    key=('lv18_fern_bed','lv18_bloom_bush','lv18_flower_rock')[i%3]
    prop('edge_understory_'+str(i),key,x,y,placement='layered-field-edge')

# Mossy stone fragments and low ledges frame the four raised garden clearings.
# Their unbroken visual backs sit beyond every combat spawn and lane approach.
ruin_sites=[('fork_ledge','lv18_cliff_ledge',416,208),('fork_wall','lv18_ruin_wall',400,192),
 ('shed_ledge','lv18_cliff_ledge',672,504),('bridge_terrace','lv18_cliff_ledge',1456,304),
 ('bramble_wall','lv18_ruin_wall',1504,296),('greenhouse_ledge','lv18_cliff_ledge',1840,208),
 ('garden_ledge_left','lv18_cliff_ledge',2024,256),('garden_ledge_right','lv18_cliff_ledge',2200,256),
 ('garden_wall_back','lv18_ruin_wall',2112,104),('garden_wall_west','lv18_ruin_wall',2016,160)]
for name,sprite,x,y in ruin_sites:
    # Architectural silhouettes may back a clearing but never cover its road.
    if lane_distance(x,y)<29:continue
    prop(name,sprite,x,y,placement='mossy-ruin-terrace');counts['ruins']+=1
for i,(x,y) in enumerate(((344,232),(520,216),(1376,320),(1544,304),(1792,240),(1904,232),(2016,128),(2208,128),(2016,224),(2208,224))):
    if protected(x,y,30,42,76):continue
    prop('ruin_column_'+str(i),'lv18_ruin_column',x,y,placement='mossy-ruin-terrace');counts['ruins']+=1

# The ruined stone garden keeps its circular identity with a violet central
# medallion formed by an eight-petal planted rosette on the pale stone court.
for i in range(8):
    angle=i*math.pi/4
    prop('garden_rosette_'+str(i),'lv18_lavender_patch',2112+math.cos(angle)*30,176+math.sin(angle)*25,scale=.52,groundDetail=False,placement='ruined-garden-medallion')
prop('garden_rosette_heart','lv18_bluebell_meadow',2112,176,scale=.65,groundDetail=False,placement='ruined-garden-medallion')

# The stream bends around asymmetric planted banks. The two waterfalls sit
# against a continuous rocky lip joining both real banks, rather than floating
# as isolated ornaments inside a rectangular blue pool. The travel bridge keeps
# its exact route centre while its deck narrows to a readable stone crossing.
for y in range(7,40):
    for x in range(54,63):
        if rows[y][x]=='w':rows[y][x]='g'
# Remove the former oversized bridge shoulders; the actual lane is y272–320.
for y in (16,20):
    for x in range(56,61):
        if rows[y][x]=='b':rows[y][x]='g'
stream_profile={7:(936,24),8:(928,24),9:(928,24),10:(936,24),11:(944,32),
 12:(944,40),13:(936,40),14:(928,32),15:(928,24),16:(936,24),
 20:(936,24),21:(944,24),22:(944,24),23:(952,24),24:(960,24),
 25:(952,24),26:(944,24),27:(936,24),28:(928,24),29:(928,24),
 30:(936,24),31:(944,24),32:(944,32),33:(936,40),34:(928,48),
 35:(928,40),36:(936,32),37:(936,24),38:(936,24),39:(936,24)}
for y,(centre,halfwidth) in stream_profile.items():
    for x in range(54,63):
        px,py=x*16+8,y*16+8
        if abs(px-centre)<=halfwidth and not protected(px,py,31,43,80) and rows[y][x] in 'gfw':rows[y][x]='w'
for y in range(17,20):
    for x in range(56,61):rows[y][x]='b'
road['tilePalette']['b']='cobble_grey'
road['objects']=[o for o in road['objects'] if o.get('placement')!='stone-bridge']
# Continuous low stone parapets stand on the two road edges. Their endposts
# frame the entrance; neither the rails nor their footings intersect the lane.
for edge,y in (('north',272),('south',328)):
    for i,x in enumerate((888,920,952,984)):
        prop('bridge_'+edge+'_rail_'+str(i),'estate_wall_h',x,y,scale=1.25,hit=[x-17,y-8,34,5],campaignLandmark='streamBridge',label='Old stone bridge parapet',placement='stone-bridge')
    for side,x in (('west',872),('east',1000)):
        prop('bridge_'+edge+'_'+side+'_post','estate_gatepost',x,y,hit=[x-5,y-10,10,8],campaignLandmark='streamBridge',label='Stone bridge endpost',placement='stone-bridge')
for i,(lip_y,fall_y) in enumerate(((152,184),(488,520))):
    prop('waterfall_rocky_lip_'+str(i),'lv18_cliff_ledge',936,lip_y,scale=1.5,placement='stream-rocky-lip')
    prop('waterfall_'+str(i),'lv18_waterfall',936,fall_y,placement='stream-waterfall');counts['water']+=1
    for side,dx,dy in (('west',-36,8),('east',36,14)):
        prop('waterfall_bank_'+str(i)+'_'+side,'lv18_flower_rock',936+dx,lip_y+dy,placement='stream-rock-garden')
# Irregular species and offsets soften the bank silhouette. These shallow
# plants may overhang water visually but never cover a walking lane.
bank_plants=[('lv18_flower_rock',892,192,1),('lv18_fern_bed',884,232,1.1),
 ('lv18_bloom_bush',978,216,.8),('lv18_bluebell_meadow',992,248,.9),
 ('lv18_flower_rock',904,248,.85),('lv18_fern_bed',916,364,1.1),
 ('lv18_flower_rock',988,384,1),('lv18_bluebell_meadow',904,408,1),
 ('lv18_bloom_bush',968,448,.85),('lv18_fern_bed',890,520,1.15),
 ('lv18_flower_rock',992,552,1.1),('lv18_bluebell_meadow',904,584,1)]
for i,(sprite,x,y,scale) in enumerate(bank_plants):
    if lane_distance(x,y)>34:prop('riverbank_plant_'+str(i),sprite,x,y,scale=scale,groundDetail=False,placement='asymmetric-stream-bank')
woody=lambda o:o['sprite'].startswith(('tree','bush')) or o['sprite'] in ('lv18_birch','lv18_birch_cluster','lv18_flowering_tree')
road['objects']=[o for o in road['objects'] if o.get('forage') or is_boundary(o) or not woody(o) or tile(o['x'],o['y'])!='w']

road['tiles']=[''.join(row) for row in rows]
road['detailVersion']=18
road['landscapeLayers']={'palette':'moss green / warm cream stone / saturated lavender / blue-white wildflowers / pink canopy',
 'fields':[{'id':'lavenderway_field_'+str(i),'at':[x,y],'radius':[rx,ry]} for i,(x,y,rx,ry) in enumerate(field_islands)],
 'counts':counts,'streamPools':[[936,208],[928,552]],'stoneBridge':{'deck':[896,272,80,48],'railEdges':[272,328]},'roadOnly':True}
road['designIntent']='A separate wild road through dense lavender ribbons, blue-white meadow carpets, pale birch and pink flowering woodland, mossy stone terraces, a bright stream and ruined garden landmarks; four clear combat lawns connect to the warm pale walking route.'
# The road is still wilderness: no residents, houses, services or town portals
# are introduced by its richer environmental rendering.
assert not road.get('residents')
for key,original in retained.items():assert road.get(key)==original,'Saved road hook changed: '+key
assert [o for o in road['objects'] if o.get('forage')]==forage_before,'A saved forage source changed'
assert counts['lavender']>=90,counts
assert counts['meadow']>=25,counts
maps['lavenderway']=road
for key,original in unchanged.items():assert json.dumps(maps[key],ensure_ascii=False,separators=(',',':'))==original,'Unrelated area changed: '+key
assert sum(bool(o.get('forage')) for area in maps.values() for o in area['objects'])==109
MAP_FILE.write_text(json.dumps(maps,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'map':'lavenderway','detailVersion':18,'unchangedMaps':len(unchanged),'layers':counts,'campAndQuestCoordinates':'unchanged'}))
