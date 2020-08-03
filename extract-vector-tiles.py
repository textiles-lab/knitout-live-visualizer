#!/usr/bin/env python3

#
# Based on code from Chesskoban (c) 2017-2019 Jim McCann;
# this adapted-for-15-466 code is released into the public domain.
#

import xml.parsers.expat
import re
import math
import sys

insvg = 'vector-tiles.svg'
jsname = 'VectorTilesLib.js'

xmlparser = xml.parsers.expat.ParserCreate()

def mul(A,B):
	if len(A) == 6 and len(B) == 6:
		return (
			A[0] * B[0] + A[2] * B[1] + A[4] * 0.0,
			A[1] * B[0] + A[3] * B[1] + A[5] * 0.0,
			A[0] * B[2] + A[2] * B[3] + A[4] * 0.0,
			A[1] * B[2] + A[3] * B[3] + A[5] * 0.0,
			A[0] * B[4] + A[2] * B[5] + A[4] * 1.0,
			A[1] * B[4] + A[3] * B[5] + A[5] * 1.0
		)
	elif len(A) == 6 and len(B) == 2:
		return (
			A[0] * B[0] + A[2] * B[1] + A[4] * 1.0,
			A[1] * B[0] + A[3] * B[1] + A[5] * 1.0
		)
	else:
		assert(False) #"Invalid multiply arg lengths " + str(len(A)) + " and " + str(len(B)))

def inv(A):
	assert(len(A) == 6)
	a = A[0]
	b = A[2]
	c = A[1]
	d = A[3]
	x = A[4]
	y = A[5]

	invdet = 1.0 / (a*d - c*b)
	a *= invdet
	b *= invdet
	c *= invdet
	d *= invdet
	B = ( d, -c, -b,  a, -(d * x + -b * y), -(-c * x + a * y) )
	P = mul(A,B)
	#print("Matrix: " + repr(A) + " / Inverse: " + repr(B) + " / Product: " + repr(P))
	return B

def parse_transform(transform):
	#print('parsing: ' + transform)
	#transform is a list of zero or more commands
	wsp = '[\x20\x09\x0D\x0A]'
	comma_wsp = '[\x20\x09\x0D\x0A,]'
	number = r'[+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?'
	first = True
	xf = (1,0, 0,1, 0,0)
	while True:
		if first: ws = wsp + '*'
		else: ws = comma_wsp + '+'
		first = False
		m = re.match(
			ws
			+ r'(matrix|translate|scale|rotate|skewX|skewY)'
			+ wsp + '*'
			+ r'\('
			+ wsp + '*'
			+ '(' + number + '(:?' + comma_wsp + '+' + number + ')*' + ')'
			+ wsp + '*'
			+ r'\)'
		, transform)
		if m == None: break
		op = m.group(1)
		args = list(map(float, re.split(comma_wsp + '+', m.group(2))))
		#print("op: " + op)
		#print("args: " + repr(args))
		mat = (1,0, 0,1, 0,0)
		if op == 'matrix':
			if len(args) == 6:
				mat = tuple(args)
			else:
				print("WARNING: ignoring matrix with args " + repr(args) + " (non-length-6)")
		elif op == 'translate':
			if len(args) == 2:
				mat = (1,0, 0,1, args[0], args[1])
			elif len(args) == 1:
				mat = (1,0, 0,1, args[0], 0)
			else:
				print("WARNING: ignoring translate with args " + repr(args) + " (non-length-6)")
		elif op == 'scale':
			if len(args) == 2:
				mat = (args[0],0, 0,args[1], 0,0)
			elif len(args) == 1:
				mat = (args[0],0, 0,args[0], 0,0)
			else:
				print("WARNING: ignoring scale with args " + repr(args) + " (non-length-6)")
		elif op == 'rotate':
			if len(args) == 3 or len(args) == 1:
				cos = math.cos(math.pi * args[0] / 180.0)
				sin = math.sin(math.pi * args[0] / 180.0)
				mat = (cos,sin, -sin,cos, 0,0)
				if len(args) == 3:
					mat = mul( (1,0, 0,1,  args[1], args[2]),
						mul( mat, (1,0, 0,1, -args[1],-args[2]) ) )
			else:
				print("WARNING: ignoring rotate with args " + repr(args) + " (non-length-6)")
		elif op == 'skewX':
			if len(args) == 1:
				tan = math.tan(math.pi * args[0] / 180.0)
				mat = (1,0, tan,1, 0,0)
			else:
				print("WARNING: ignoring skewX with args " + repr(args) + " (non-length-6)")
		elif op == 'skewY':
			if len(args) == 1:
				tan = math.tan(math.pi * args[0] / 180.0)
				mat = (1,tan, 0,1, 0,0)
			else:
				print("WARNING: ignoring skewY with args " + repr(args) + " (non-length-6)")

		else:
			assert(False) # "shouldn't have an op named '" + op + "'"

		xf = mul(xf, mat)

		transform = transform[m.end():]
	
	if not re.fullmatch(wsp + '*', transform):
		print("WARNING: ignoring trailing transform information '" + transform + "'")

	return xf

def parse_path(data):
	idx = 0

	def peek():
		nonlocal idx, data
		if idx < len(data): return data[idx]
		else: return 'EOF'

	def get():
		nonlocal idx, data
		assert(idx < len(data))
		idx += 1
		return data[idx-1]


	#divide path into command groups by implementing the grammar from the SVG spec:
	def skip_wsp_star():
		while peek() in '\x20\x09\x0D\x0A':
			get()
	
	def read_number():
		if peek() not in '+-0123456789.': return None
		num = ''
		if peek() in '+-': num += get()
		while peek() in '0123456789': num += get()
		if peek() == '.':
			num += get()
			while peek() in '0123456789': num += get()
		if peek() in 'eE':
			num += get()
			if peek() in '+-': num += get()
			while peek() in '0123456789': num += get()
		return float(num)

	def skip_comma_wsp():
		skip_wsp_star()
		if peek() == ',':
			get()
			skip_wsp_star()
	
	def read_coordinate_pair():
		x = read_number()
		if x == None: return None
		skip_comma_wsp()
		y = read_number()
		assert(y != None)
		return (x, y)

	def read_moveto():
		cmd = get()
		assert(cmd in 'mM')
		skip_wsp_star()
		args = []
		while True:
			pair = read_coordinate_pair()
			if pair == None:
				assert(len(args) > 0)
				break
			args.append(pair)
			skip_comma_wsp()
		return (cmd, args)

	def read_drawto():
		if peek() not in 'ZzLlHhVvCcSsQqTtAa': return None
		cmd = get()
		args = []
		if cmd in 'Zz':
			pass #no args
		elif cmd in 'LlTt':
			skip_wsp_star()
			while True:
				a = read_coordinate_pair()
				if a == None:
					assert(len(args) > 0)
					break
				args.append(a)
				skip_comma_wsp()
		elif cmd in 'HhVv':
			skip_wsp_star()
			while True:
				a = read_number()
				if a == None:
					assert(len(args) > 0)
					break
				args.append(a)
				skip_comma_wsp()
		elif cmd in 'Cc':
			skip_wsp_star()
			while True:
				a = read_coordinate_pair()
				if a == None:
					assert(len(args) > 0)
					break
				args.append(a)
				skip_comma_wsp()
				a = read_coordinate_pair()
				assert(a != None)
				args.append(a)
				skip_comma_wsp()
				a = read_coordinate_pair()
				assert(a != None)
				skip_comma_wsp()
				args.append(a)
		elif cmd in 'SsQq':
			skip_wsp_star()
			while True:
				a = read_coordinate_pair()
				if a == None:
					assert(len(args) > 0)
					break
				args.append(a)
				skip_comma_wsp()
				a = read_coordinate_pair()
				assert(a != None)
				args.append(a)
		elif cmd in 'Aa':
			skip_wsp_star()
			while True:
				rx = read_nonnegative_number()
				if rx == None:
					assert(len(args) > 0)
					break
				skip_comma_wsp()

				ry = read_nonnegative_number()
				assert(ry != None)
				skip_comma_wsp()

				x_axis_rotation = read_number()
				assert(x_axis_rotation != None)
				skip_comma_wsp()

				large_arc_flag = read_flag()
				assert(large_arc_flag != None)
				skip_comma_wsp()

				sweep_flag = read_flag()
				assert(sweep_flag != None)
				skip_comma_wsp()

				x = read_number()
				assert(x != None)
				skip_comma_wsp()

				y = read_number()
				assert(y != None)
				skip_comma_wsp()
				args.append((rx, ry, x_axis_rotation, large_arc_flag, sweep_flag, x, y))
		else:
			assert(False)
		return (cmd, args)

			
	cmds = []
	while True:
		skip_wsp_star()
		if peek() == 'EOF': break
		moveto = read_moveto()
		assert(moveto)
		cmds.append(moveto)
		while True:
			skip_wsp_star()
			drawto = read_drawto()
			if drawto == None: break
			cmds.append(drawto)
	return cmds

tiles = dict()

class Tile:
	def __init__(self, name):
		self.accum = dict()
		self.accum['y1'] = []
		self.accum['y2'] = []
		self.accum['l1'] = []
		self.accum['l2'] = []
		self.accum['a1'] = []
		self.accum['a2'] = []
		self.rect_xf = (1,0, 0,1, 0,0)
		self.rect = None
		self.name = name

xf_stack = [(1,0, 0,1, 0,0)]
tile_stack = [None]
accum_stack = [None]

def start_element(name, attrs):
	#handle transform:
	xf = (1,0, 0,1, 0,0)
	if 'transform' in attrs: xf = parse_transform(attrs['transform'])
	xf_stack.append(mul(xf_stack[-1], xf))

	#handle label:
	label = ''
	if 'inkscape:label' in attrs: label = attrs['inkscape:label']

	accum = accum_stack[-1]
	tile = tile_stack[-1]

	if label.startswith('tile:'):
		if tile != None: print("WARNING: nested tiles.")
		#start a new tile:
		tile = Tile(label[len('tile:'):])
		accum = tile.accum
	elif tile and name == 'rect':
		#switch to box accumulator:
		if tile.rect != None: print("WARNING: multiple rects in tile.")
		x = float(attrs['x'])
		y = float(attrs['y'])
		width = float(attrs['width'])
		height = float(attrs['height'])
		tile.rect = (x, y, width, height)
		tile.rect_xf = xf_stack[-1]

	accum_stack.append(accum)
	tile_stack.append(tile)

	d = None
	target = None
	if name == 'path' and 'd' in attrs:
		d = attrs['d']
		style = attrs['style']
		m = re.match(r'(|.*;)\s*stroke:\s*([^;\s]+)\s*;', style)
		col = m[2]
		if   col == '#ff0000': target = 'l1'
		elif col == '#00ff00': target = 'l2'
		elif col == '#800000': target = 'y1'
		elif col == '#008000': target = 'y2'
		elif col == '#ff00ff': target = 'a1'
		elif col == '#00ffff': target = 'a2'
		else: print("Unknown target for color: " + col + "!")
	
	if d != None and accum != None:
		#print(d)
		accum[target].append( (xf_stack[-1], parse_path(d) ) )

def end_element(name):
	tile = tile_stack[-1]
	xf_stack.pop()
	accum_stack.pop()
	tile_stack.pop()

	if tile != None and tile_stack[-1] == None:
		if len(tile.accum["l1"]) == 0 and len(tile.accum["l2"]) == 0: pass #tile.name += "-l0"
		elif len(tile.accum["l2"]) == 0: tile.name += "-l1"
		else: tile.name += "-l2"

		if len(tile.accum["y1"]) == 0 and len(tile.accum["y2"]) == 0: pass #tile.name += "-y0"
		elif len(tile.accum["y2"]) == 0: tile.name += "-y1"
		else: tile.name += "-y2"

		if len(tile.accum["a1"]) == 0 and len(tile.accum["a2"]) == 0: pass #tile.name += "-y0"
		elif len(tile.accum["a2"]) == 0: tile.name += "-a1"
		else: tile.name += "-a2"


		assert(tile.name not in tiles)
		tiles[tile.name] = tile


xmlparser.StartElementHandler = start_element
xmlparser.EndElementHandler = end_element

xmlparser.ParseFile(open(insvg, 'rb'))


def cmds_to_lines(xf, cmds):
	lines = []
	def approx_bezier(a,b,c,d):
		nonlocal lines
		perp = (d[1] - a[1], -(d[0] - a[0]))

		amt = max(
			abs(perp[0] * (b[0]-a[0]) + perp[1] * (b[1]-a[1])),
			abs(perp[0] * (c[0]-a[0]) + perp[1] * (c[1]-a[1]))
			) / math.sqrt(perp[0]*perp[0] + perp[1]*perp[1])
		if amt > 0.02:
			ab = (0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1]))
			bc = (0.5 * (b[0] + c[0]), 0.5 * (b[1] + c[1]))
			cd = (0.5 * (c[0] + d[0]), 0.5 * (c[1] + d[1]))
			abc = (0.5 * (ab[0] + bc[0]), 0.5 * (ab[1] + bc[1]))
			bcd = (0.5 * (bc[0] + cd[0]), 0.5 * (bc[1] + cd[1]))
			abcd = (0.5 * (abc[0] + bcd[0]), 0.5 * (abc[1] + bcd[1]))
			approx_bezier(a, ab, abc, abcd)
			approx_bezier(abcd, bcd, cd, d)
		else:
			lines += [a,b, b,c, c,d]

	start = None
	prev = (0.0, 0.0)
	prev_cp = (0.0, 0.0)
	for ca in cmds:
		cmd = ca[0]
		args = ca[1]

		if cmd in 'Mm':
			start = None
			for pt in args:
				if cmd == 'm': pt = (prev[0] + pt[0], prev[1] + pt[1])
				if start == None:
					start = pt
					prev_cp = prev = pt
				if prev != pt: lines += [mul(xf, prev), mul(xf, pt)]
				prev_cp = prev = pt
		elif cmd in 'Hh':
			for x in args:
				if cmd == 'h': pt = (prev[0] + x, prev[1])
				else: pt = (x, prev[1])
				if prev != pt: lines += [mul(xf, prev), mul(xf, pt)]
				prev_cp = prev = pt
		elif cmd in 'Vv':
			for y in args:
				if cmd == 'v': pt = (prev[0], prev[1] + y)
				else: pt = (prev[0], y)
				if prev != pt: lines += [mul(xf, prev), mul(xf, pt)]
				prev_cp = prev = pt

		elif cmd in 'Ll':
			for pt in args:
				if cmd == 'l': pt = (prev[0] + pt[0], prev[1] + pt[1])
				if prev != pt: lines += [mul(xf, prev), mul(xf, pt)]
				prev_cp = prev = pt
		elif cmd in 'Cc':
			for i in range(0, len(args), 3):
				p1 = args[i]
				p2 = args[i+1]
				p3 = args[i+2]
				if cmd == 'c':
					p1 = (prev[0] + p1[0], prev[1] + p1[1])
					p2 = (prev[0] + p2[0], prev[1] + p2[1])
					p3 = (prev[0] + p3[0], prev[1] + p3[1])

				approx_bezier(mul(xf, prev), mul(xf, p1), mul(xf, p2), mul(xf, p3))

				prev_cp = p2
				prev = p3
			
		elif cmd in 'Zz':
			pt = start
			if prev != pt: lines += [mul(xf, prev), mul(xf, pt)]
			prev = pt
		else:
			print("Skipping unimplemented command '" + cmd + "'")
	return lines

def accum_to_lines(accum, outer_xf):
	lines = []
	for xc in accum:
		xf = xc[0]
		cmds = xc[1]
		lines += cmds_to_lines(mul(outer_xf, xf), cmds)
	return lines

tile_size = (13.0, 9.0)

out = 'window.VectorTilesLib = {'

first_tile = True
for (name, tile) in tiles.items():
	if first_tile: first_tile = False
	else: out += ',\n'
	out += '"' + tile.name + '":{\n'

	#find rectangle (in page coordinate system):
	inf = float('inf')
	rect_min = (inf, inf)
	rect_max = (-inf, -inf)
	for x in [tile.rect[0], tile.rect[0] + tile.rect[2]]:
		for y in [tile.rect[1], tile.rect[1] + tile.rect[3]]:
			pt = mul(tile.rect_xf, (x,y))
			rect_min = (min(rect_min[0], pt[0]), min(rect_min[1], pt[1]))
			rect_max = (max(rect_max[0], pt[0]), max(rect_max[1], pt[1]))
	
	#print("   rect_xf is " + str(tile.rect_xf))
	#print("   rect is " + str(rect_min) + " to " + str(rect_max))

	scale = (
		tile_size[0] / (rect_max[0] - rect_min[0]),
		tile_size[1] / (rect_max[1] - rect_min[1])
	)

	world_to_tile_xf = (scale[0],0, 0,-scale[1], -rect_min[0],rect_max[1])

	#print("   rect min xforms to " + str(mul(world_to_tile_xf, rect_min)))
	#print("   rect max xforms to " + str(mul(world_to_tile_xf, rect_max)))

	first_label = True
	for (label, acc) in tile.accum.items():
		if len(acc) == 0: continue
		if first_label: first_label = False
		else: out += ',\n'
		out += '\t"' + label + '":[\n'
		for (xf, cmds) in acc:
			lines = cmds_to_lines( mul( world_to_tile_xf, xf ), cmds )
			assert(len(lines) % 2 == 0)
			chains = []
			chain = None
			for i in range(0,len(lines), 2):
				def t(num):
					s = f"{num:.4f}"
					while s.endswith('0'): s = s[0:-1]
					if s.endswith('.'): s = s[0:-1]

					return s
				a = t(lines[i][0]) + ',' + t(lines[i][1])
				b = t(lines[i+1][0]) + ',' + t(lines[i+1][1])
				if chain == None or chain[len(chain)-1] != a:
					chain = [a,b]
					chains.append(chain)
				else:
					chain.append(b)
			first = True
			for chain in chains:
				if first: first = False
				else: out += ',\n'
				out += '\t\t[' + ', '.join(chain) + ']'
		out += '\n\t]'
	out += '\n}'

out += '\n};'

#print(out)

with open(jsname, 'wb') as jsfile:
	jsfile.write(out.encode('utf8'))

print("Wrote " + jsname)
