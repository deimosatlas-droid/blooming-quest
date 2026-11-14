#!/usr/bin/env python3
"""Apply the authored v17 composition pass to the existing playable maps.

This is an additive authoring tool, not a build-time generator. Existing stable
resident, camp and forage IDs, the ferry routes, and the v16 estate are retained.
"""
from collections import deque
from pathlib import Path
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / 'dist/fixed-maps.json'
maps = json.loads(MAPS.read_text())
atlas = json.loads((ROOT / 'dist/assets/world-v05.json').read_text())
estate_digest = hashlib.sha256(json.dumps(maps['rosepetal'], sort_keys=True).encode()).hexdigest()


def interpolate(points, x):
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        if ax <= x <= bx:
            return ay + (by - ay) * (x - ax) / max(1, bx - ax)
    return points[0][1] if x < points[0][0] else points[-1][1]


def tile_at(rows, x, y):
    return rows[y][x] if 0 <= y < len(rows) and 0 <= x < len(rows[0]) else 'x'


def move_object(o, dy):
    o['y'] += dy
    if o.get('hit'):
        o['hit'][1] += dy


def shrink_wide_paths(area):
    """Trim broad lawn-facing shoulders; thin door paths and bridges survive."""
    rows = [list(row) for row in area['tiles']]
    road = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch in 'dc'}
    distance = {}
    queue = deque()
    for x, y in road:
        if any((x + dx, y + dy) not in road for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0))):
            distance[x, y] = 1
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            point = x + dx, y + dy
            if point in road and point not in distance:
                distance[point] = distance[x, y] + 1
                queue.append(point)
    trimmed = 0
    for (x, y), depth in distance.items():
        if depth != 1 or x < 3 or x >= area['w'] - 3:
            continue
        # Never alter water-adjacent bridge approaches or authored farm beds.
        if any(tile_at(rows, x + dx, y + dy) in 'wbf' for dx in range(-1, 2) for dy in range(-1, 2)):
            continue
        if not any(tile_at(rows, x + dx, y + dy) == 'g' for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0))):
            continue
        if any(distance.get((x + dx, y + dy), 0) >= 3 for dx in range(-2, 3) for dy in range(-2, 3)):
            rows[y][x] = 'g'
            trimmed += 1
    area['tiles'] = [''.join(row) for row in rows]
    return trimmed


TOWNS = {
    'lavendyr': ('Herbalists’ Court', 'lavender gardens, herb drying and quiet cottage lanes'),
    'sunveil': ('Golden Market', 'warm market paving, bakeries and a workshop district'),
    'tidepetal': ('Riverworkers’ Quay', 'working timber quays, net-mending yards and cargo courts'),
    'seabloom': ('Seaglass Harbour', 'coastal gardens, lighthouse approach and a fish-market court'),
    'hydrangea': ('Bridgewater Court', 'riverbank flower gardens and small bridge-side trade courts'),
    'thornrose': ('Stoneworkers’ Yard', 'stone terraces, forge yards and pine-framed cottage lanes'),
    'moonblossom': ('Lantern Circle', 'moonflower gardens, reading courts and mossy stream paths'),
}


def dress_town(area, index):
    if area.get('compositionVersion') == 17:
        return
    trimmed = shrink_wide_paths(area)
    buildings = [o for o in area['objects'] if o['sprite'].startswith('town_house_')]
    # The first two buildings are in the same gameplay view. Give them different
    # approved silhouettes, then vary the remaining street rhythm predictably.
    for i, house in enumerate(buildings):
        old = atlas[house['sprite']]
        variant = (i + index) % 3
        key = 'town_house_' + area['id'] + '_' + str(variant)
        new = atlas[key]
        previous_door = house['x'] + old.get('doorOffset', 0)
        house['sprite'] = key
        width = max(32, new['rect'][2] - 14)
        house['hit'] = [house['x'] - width // 2, house['y'] - 27, width, 22]
        house['frontageStyle'] = ['herb-doorstep', 'lantern-porch', 'flower-window'][i % 3]
        # Keep entry and return coordinates matched to the actual doorway.
        portal = min((p for p in area['portals'] if p.get('kind') == 'door'),
                     key=lambda p: abs(p['x'] - previous_door) + abs(p['y'] - house['y'] - 8), default=None)
        if portal and abs(portal['x'] - previous_door) < 18 and abs(portal['y'] - house['y'] - 8) < 18:
            portal['x'] = house['x'] + new.get('doorOffset', 0)
            interior = maps.get(portal['target'])
            if interior and interior.get('returnAt'):
                interior['returnAt'][0] = portal['x']
        # Each frontage gets a different low planting pattern. These are wall-
        # side flowers, with no new obstruction in NPC or player travel space.
        flower = {'lavendyr':'flora_purple', 'sunveil':'flora_yellow', 'tidepetal':'flora_blue',
                  'seabloom':'flora_white', 'hydrangea':'flora_blue', 'thornrose':'fern',
                  'moonblossom':'flora_white'}[area['id']]
        side = -1 if i % 2 else 1
        for j in range(1 + i % 3):
            x = house['x'] + side * (width // 2 + 7 + j * 7)
            y = house['y'] - 6 - (j % 2) * 5
            if tile_at(area['tiles'], int(x // 16), int(y // 16)) == 'g':
                area['objects'].append({'id':area['id']+'_frontage_'+str(i)+'_'+str(j),
                    'sprite':flower, 'x':x, 'y':y, 'scale':1,
                    'placement':'building-frontage', 'compositionVersion':17})
    # Recognisable public courts use the existing second street material, while
    # their connecting lanes remain narrower. No new colliders are introduced.
    rows = [list(row) for row in area['tiles']]
    centre = area['spawn']
    court_x, court_y = int(centre[0] // 16), int(centre[1] // 16)
    for y in range(court_y - 2, court_y + 2):
        for x in range(court_x - 3, court_x + 4):
            if tile_at(rows, x, y) in 'dc':
                rows[y][x] = 'c' if area['id'] == 'lavendyr' else 'd'
    area['tiles'] = [''.join(row) for row in rows]
    area['compositionVersion'] = 17
    area['districts'] = [
        {'name':TOWNS[area['id']][0], 'kind':'public-court', 'at':list(centre)},
        {'name':'Cottage lanes', 'kind':'residential', 'buildings':[p['target'] for p in area['portals'] if p.get('kind') == 'door']},
        {'name':'Local work yards', 'kind':'work', 'equipment':[s['id'] for s in area.get('workstations',[]) if s['kind'] not in ('seat','plant')]},
    ]
    area['designIntent'] = TOWNS[area['id']][1] + '; connected lanes, varied frontages and a distinct public court'
    area['compositionChanges'] = {'narrowedShoulderTiles':trimmed, 'variedFrontages':len(buildings)}


ROAD_PROFILES = {
    'lavenderway': ([0, 0, 2, 3, 1, -2, 0, 0], 'Cultivated margins and gentle field bends', 'fields'),
    'foxglove': ([0, 0, -1, 3, -2, 0, 0, 0], 'Flower meadows and uneven woodland shoulders', 'meadow'),
    'marigold': ([0, 0, 3, 1, -2, -3, 0, 0], 'River approaches and a broad reed-bank crossing', 'river'),
    'coastroad': ([0, 0, 2, 4, -3, -1, 0, 0], 'A curving coastal trail and sheltered sea inlet', 'coast'),
    'nightshade': ([0, 0, -2, -1, 3, -2, 0, 0], 'Pine-framed bends and separated forest clearings', 'forest'),
    'moonpath': ([0, 0, 4, 2, -4, -3, 0, 0], 'Lantern glades around a quiet moonlit pond', 'moon'),
}

CAMP_LAYOUTS = {
    'lavenderway': ([.13,.31,.68,.87], [-1,1,-1,1]),
    'foxglove': ([.17,.42,.63,.82], [-1,-1,1,1]),
    'marigold': ([.13,.33,.66,.89], [1,-1,1,-1]),
    'coastroad': ([.16,.38,.68,.88], [-1,1,-1,-1]),
    'nightshade': ([.12,.32,.64,.84], [1,-1,-1,1]),
    'moonpath': ([.16,.41,.65,.88], [-1,1,1,-1]),
}


def vary_camp_clearings(area):
    rows = [list(row) for row in area['tiles']]
    fractions, sides = CAMP_LAYOUTS[area['id']]
    for i, camp in enumerate(area['camps']):
        old_x, old_y = camp['x'], camp['y']
        ox, oy = round((old_x-8)/16), round((old_y-8)/16)
        for y in range(max(4,oy-4),min(area['h']-4,oy+5)):
            for x in range(max(4,ox-5),min(area['w']-4,ox+6)):
                if rows[y][x] == 'd' and abs(y-interpolate(area['waypoints'],x)) > 2.5:
                    rows[y][x] = 'g'
        side = sides[i]
        desired = round((area['w']-1)*fractions[i])
        choices = sorted(range(max(12,desired-15),min(area['w']-12,desired+16)),key=lambda x:abs(x-desired))
        selected = None
        for x in choices:
            road_y = interpolate(area['waypoints'],x)
            y = max(8,min(area['h']-8,round(road_y + (-6.5 if side<0 else 8))))
            px,py = x*16+8,y*16+8
            if any(tile_at(rows,xx,yy) in 'wb' for xx in range(x-5,x+6) for yy in range(y-5,y+5)):
                continue
            if any(math.hypot(o['x']-px,o['y']-py)<130 for o in area['objects'] if o.get('forage')):
                continue
            selected=x,y,road_y
            break
        if not selected:
            # Retaining a proven clearing is safer than an inaccessible camp.
            selected=ox,oy,interpolate(area['waypoints'],ox)
        x,y,road_y=selected
        px,py=x*16+8,y*16+8
        def touches_clearing(o):
            if o.get('forage') or str(o.get('id','')).startswith('audit_v11_'):
                return False
            art=atlas[o['sprite']];scale=o.get('scale',1)
            left=o['x']-art['anchor'][0]*scale;top=o['y']-art['anchor'][1]*scale
            return left<px+74 and left+art['rect'][2]*scale>px-74 and top<py+62 and top+art['rect'][3]*scale>py-78
        area['objects']=[o for o in area['objects'] if not touches_clearing(o)]
        for yy in range(y-4,y+5):
            for xx in range(x-5,x+6):
                if tile_at(rows,xx,yy) not in 'wb' and ((xx-x)/4.5)**2+((yy-y)/3.5)**2 < 1:
                    rows[yy][xx]='d'
        # A curved three-tile spur follows the den's open side to the trail.
        end_y=y+2 if side<0 else y-2
        for yy in range(min(round(road_y),end_y),max(round(road_y),end_y)+1):
            bend=round(math.sin((yy-min(round(road_y),end_y))*.45))*(1 if i%2 else -1)
            for xx in range(x-1+bend,x+2+bend):
                if tile_at(rows,xx,yy) not in 'wb': rows[yy][xx]='d'
        camp['x'],camp['y']=px,py
        camp['spawnPoints']=[[px-24,py+22],[px+24,py+22],[px,py+42]]
        camp['side']='north' if side<0 else 'south'
        camp['compositionVersion']=17
    area['tiles']=[''.join(row) for row in rows]


def compose_road(area):
    if area.get('compositionVersion') == 17:
        return
    deltas, description, geography = ROAD_PROFILES[area['id']]
    before = area['waypoints']
    after = [[x, y + deltas[i]] for i, (x, y) in enumerate(before)]
    shift = lambda x: round(interpolate(after, x / 16) - interpolate(before, x / 16)) * 16
    rows = [list(row) for row in area['tiles']]
    changed = [row[:] for row in rows]
    # All columns are translated as a unit, retaining the road/camp/bridge
    # relationship. The outer four tile rows and edge exits remain untouched.
    for x in range(4, area['w'] - 4):
        dy = shift(x * 16 + 8) // 16
        if not dy:
            continue
        for y in range(4, area['h'] - 4):
            changed[y][x] = 'g'
        for y in range(4, area['h'] - 4):
            yy = y + dy
            if 4 <= yy < area['h'] - 4:
                changed[yy][x] = rows[y][x]
    for o in area['objects']:
        # Boundary trunks and repair-row colliders are never translated.
        if 64 <= o['x'] < area['w'] * 16 - 64 and 96 <= o['y'] < area['h'] * 16 - 96 and not str(o.get('id','')).startswith('audit_v11_'):
            move_object(o, shift(o['x']))
    for camp in area.get('camps', []):
        camp['y'] += shift(camp['x'])
        camp['spawnPoints'] = [[x, y + shift(x)] for x, y in camp.get('spawnPoints', [])]
        camp['clearedLandmark'] = ['Wildflowers reclaim this clearing.', 'Travellers have left a repaired trail marker.',
                                  'The woodland animals have returned.', 'A quiet place to rest beside the road.'][int(camp['id'].split('-')[-1]) - 1]
    for grove in area.get('forageGroves', []):
        if isinstance(grove, dict) and isinstance(grove.get('x'), (int, float)) and isinstance(grove.get('y'), (int, float)):
            grove['y'] += shift(grove['x'])
    area['tiles'] = [''.join(row) for row in changed]
    area['waypoints'] = after
    vary_camp_clearings(area)
    shrink_wide_paths(area)
    # Route-specific water features occupy distant clearings, never forage,
    # camps, the main trail, or the forested world boundary.
    if geography in ('coast', 'moon'):
        cx = int(area['w'] * (.62 if geography == 'coast' else .33))
        cy = area['h'] - 9 if geography == 'coast' else 9
        rx, ry = (15, 4) if geography == 'coast' else (9, 3)
        terrain = [list(row) for row in area['tiles']]
        pond = set()
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                px, py = x * 16 + 8, y * 16 + 8
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1:
                    continue
                if tile_at(terrain, x, y) != 'g':
                    continue
                if any(math.hypot(o['x']-px,o['y']-py)<48 for o in area['objects'] if o.get('forage')):
                    continue
                if any(math.hypot(c['x']-px,c['y']-py)<100 for c in area.get('camps', [])):
                    continue
                pond.add((x, y))
                terrain[y][x] = 'w'
        area['objects'] = [o for o in area['objects'] if (int(o['x']//16),int(o['y']//16)) not in pond or o.get('forage') or o.get('id','').startswith('audit_v11_')]
        area['tiles'] = [''.join(row) for row in terrain]
        area['landmarks'] = [{'name':'Seaglass Inlet' if geography == 'coast' else 'Stillmoon Pool', 'kind':geography, 'at':[cx*16,cy*16]}]
    area['compositionVersion'] = 17
    area['geography'] = description
    area['pathStyle'] = 'Narrow curving travel stretches open into broad roadside combat clearings.'


def repair_forage_reach(area):
    """Keep fruit trunks outside retained forest-edge colliders after bending.

    A free standing point is insufficient: the actual reach segment must also
    clear every other trunk and intact camp, and this plant must be selectable.
    """
    plants=[o for o in area['objects'] if o.get('forage')]
    objects=[o for o in area['objects'] if o.get('hit')]
    camp_boxes=[]
    for camp in area.get('camps',[]):
        art=atlas['camp_'+camp['type']];width=round(art['rect'][2]*.78);height=round(min(28,art['rect'][3]*.55))
        camp_boxes.append([camp['x']-width/2,camp['y']-height,width,height])

    def segment_hits(start,end,box):
        low,high=0,1
        for p,d,minimum,maximum in [(start[0],end[0]-start[0],box[0],box[0]+box[2]),(start[1],end[1]-start[1],box[1],box[1]+box[3])]:
            if abs(d)<1e-8:
                if p<minimum or p>maximum:return False
            else:
                a,b=(minimum-p)/d,(maximum-p)/d
                if a>b:a,b=b,a
                low,high=max(low,a),min(high,b)
                if low>high:return False
        return high>1e-4 and low<.9999

    def approach(source):
        sx,sy=source['x'],source['y']
        near=[o for o in objects if abs(o['x']-sx)<110 and abs(o['y']-sy)<110]
        boxes=[o['hit'] for o in near]+[b for b in camp_boxes if b[0]-70<sx<b[0]+b[2]+70 and b[1]-70<sy<b[1]+b[3]+70]
        others=[o['hit'] for o in near if o is not source]+[b for b in camp_boxes if b in boxes]
        for radius in (12,20,28,34):
            for angle in range(32):
                p=(sx+math.cos(angle*math.pi/16)*radius,sy+math.sin(angle*math.pi/16)*radius)
                if any(tile_at(area['tiles'],int((p[0]+dx)//16),int((p[1]+dy)//16)) in 'wxs' for dx,dy in ((-4,-2),(4,-2),(-4,2),(4,2))):continue
                if any(p[0]+4>b[0] and p[0]-4<b[0]+b[2] and p[1]+2>b[1] and p[1]-2<b[1]+b[3] for b in boxes):continue
                if any(segment_hits(p,(sx,sy),b) for b in others):continue
                # A nearer fruit source should not permanently mask this one.
                if any(math.hypot(p[0]-o['x'],p[1]-o['y'])<radius-.01 for o in plants if o is not source):continue
                return True
        return False

    repaired=[]
    for source in plants:
        if approach(source):continue
        oldx,oldy=source['x'],source['y'];oldhit=source.get('hit',[])[:]
        direction=-1 if oldy>interpolate(area['waypoints'],oldx/16)*16 else 1
        found=False
        for distance in range(16,177,16):
            if found:break
            for dx in (0,-16,16,-32,32,-48,48,-64,64):
                nx,ny=oldx+dx,oldy+direction*distance
                if tile_at(area['tiles'],int(nx//16),int(ny//16))!='g':continue
                if any(math.hypot(nx-o['x'],ny-o['y'])<25 for o in plants if o is not source):continue
                source['x'],source['y']=nx,ny
                if oldhit:source['hit']=[oldhit[0]+nx-oldx,oldhit[1]+ny-oldy,*oldhit[2:]]
                if approach(source):found=True;break
        if not found:
            source['x'],source['y']=oldx,oldy
            if oldhit:source['hit']=oldhit
            raise ValueError('No clear forage reach for '+source['id'])
        source['placementVersion']=17
        repaired.append(source['id'])
    area['forageReachRepairs']=sorted(set(area.get('forageReachRepairs',[])+repaired))


for index, town_id in enumerate(TOWNS):
    dress_town(maps[town_id], index)
for road_id in ROAD_PROFILES:
    compose_road(maps[road_id])
    repair_forage_reach(maps[road_id])

# Eight reused inn interiors placed a shelf in front of the east guest bed.
# Put the shelf against the north wall; beds remain reachable from their feet.
repaired_rooms = []
for area in maps.values():
    if area.get('kind') != 'interior':
        continue
    for shelf in area['objects']:
        if shelf['sprite'] != 'bookshelf' or shelf.get('placementVersion') == 17:
            continue
        if any(o['sprite'] == 'bed' and abs(o['x'] - shelf['x']) < 24 and abs(o['y'] - shelf['y']) < 12 for o in area['objects']):
            move_object(shelf, -32)
            shelf['placementVersion'] = 17
            repaired_rooms.append(area['id'])

# An authored approach leads from the tea-grower's lane to the future garden
# dungeon entrance. The quest module owns the actual entrance and interactions.
lavendyr = maps['lavendyr']
if not lavendyr.get('gardenApproachVersion'):
    rows = [list(row) for row in lavendyr['tiles']]
    for ax, ay, bx, by in [(184,304,272,304), (272,304,352,256), (352,256,352,240)]:
        steps = max(1, math.ceil(math.hypot(bx-ax,by-ay) / 8))
        for n in range(steps+1):
            x, y = round((ax+(bx-ax)*n/steps)/16), round((ay+(by-ay)*n/steps)/16)
            if tile_at(rows,x,y) == 'g':
                rows[y][x] = 'd'
    lavendyr['tiles'] = [''.join(row) for row in rows]
    lavendyr['gardenApproachVersion'] = 17
    lavendyr['reservedQuestSites'] = {'gardenEntrance':[352,224], 'closedFlowers':[504,320]}

assert estate_digest == hashlib.sha256(json.dumps(maps['rosepetal'], sort_keys=True).encode()).hexdigest(), 'The v16 estate must remain untouched'
MAPS.write_text(json.dumps(maps, ensure_ascii=False, separators=(',', ':')))
print(json.dumps({'towns':list(TOWNS), 'roads':list(ROAD_PROFILES), 'interiorShelfRepairs':repaired_rooms, 'estateUnchanged':True}))
