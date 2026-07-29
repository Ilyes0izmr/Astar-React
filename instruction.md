# Retro Dungeon City Pathfinder
## UI & Art Direction Specification

---

# Overview

The visual identity of this project is inspired by classic handheld dungeon-crawlers and monochrome pixel games rather than modern dashboards or realistic city simulators.

The application should feel like a playable Game Boy-era strategy game where the city itself is represented as a miniature dungeon map.

Everything should follow a **retro arcade aesthetic** with:

- Monochrome color palette
- Chunky pixel outlines
- Minimal animations
- Pixel-perfect UI
- Large readable sprites
- Simplified geometry
- Procedurally generated assets only

The overall feeling should resemble a tiny tabletop world viewed from an isometric camera.

---

# Visual References

The UI and world should closely follow the style shown in the provided references.

Characteristics:

- Large empty background areas
- Thick pixel outlines
- Tiny character and vehicle sprites
- Dungeon-style rooms connected by corridors
- Minimal HUD
- Small pixel fonts
- Square buttons
- Flat monochrome colors
- Pixel-art buildings with rooftop details

The application should immediately resemble an old handheld adventure game rather than a technical visualization tool.

---

# Design Philosophy

The city is treated like a dungeon.

Roads become corridors.

Buildings become dungeon walls.

Intersections become rooms.

The player navigates a miniature world while watching the selected pathfinding algorithm explore the city.

Everything must be intentionally simple and readable.

Avoid realism.

Avoid modern UI trends.

No gradients.

No glossy materials.

No glassmorphism.

No rounded corners.

No realistic textures.

Everything is procedural.

---

# Color Palette

## Background

```
#D7D1C3
```

Warm parchment background.

---

## Light

```
#B8B4A7
```

Highlights

Windows

Road markings

UI accents

---

## Mid

```
#7A7772
```

Building faces

Buttons

Road details

---

## Dark

```
#44413F
```

Shadows

Roofs

Road borders

UI borders

---

## Black

```
#262626
```

Outlines

Text

Deep shadows

Sprite borders

---

Only these colors should be used throughout the project.

No additional colors unless specifically visualizing algorithm states.

---

# Typography

Font:

```
Press Start 2P
```

Fallback:

```
monospace
```

Font Sizes

| Purpose | Size |
|----------|------|
| Title | 16px |
| Panel Title | 12px |
| Button | 10px |
| Small Text | 8px |

Text should never be anti-aliased.

---

# UI Principles

Every interface element follows these rules.

- Square corners
- 2px borders
- Offset pixel shadow
- No transparency
- No rounded corners
- No gradients
- No blur
- Pixel-perfect spacing
- 8px alignment grid

Every panel should resemble an inventory window from a classic dungeon crawler.

---

# Main Menu

The application opens with a full-screen menu.

Layout:

```
+--------------------------------------+

        RETRO CITY PATHFINDER

     [   A*   ]  [ BFS ]  [ DFS ]

     [Dijkstra] [Greedy]

        GENERATE CITY

+--------------------------------------+
```

Each algorithm is displayed as a pixel-art card.

Selected card receives:

- Dark border
- Slight upward movement
- Darker background

Hover animation:

Translate upward by 2 pixels.

---

# HUD Layout

Inspired by Game Boy adventure games.

```
+--------------------------------------------------+

Algorithm: A*

Steps: 245

Visited: 310

                       FPS: 60

+--------------------------------------------------+

               3D CITY VIEW

+--------------------------------------------------+

[Generate]
[Start]
[Goal]
[Solve]
[Reset]

Speed: =====O=====

+--------------------------------------------------+
```

Minimal information.

Everything remains readable.

---

# Camera

Fixed isometric camera.

Settings

- 45° angle
- Slight downward tilt
- Smooth follow
- Zoom only
- No free orbit
- No first-person mode

The city should resemble a miniature tabletop world.

---

# City Style

The city is generated as blocks separated by roads.

Example

```
████████████████

███ ███ ███ ███

███ ███ ███ ███

────┼──────────

███ ███ ███ ███

███ ███ ███ ███

████████████████
```

The layout should resemble an overworld dungeon map.

---

# Buildings

Buildings are intentionally tiny.

Every building is generated procedurally.

No imported meshes.

Construction:

- BoxGeometry
- Canvas-generated textures
- Pixel-art façade
- Dark outlines

Height:

Random between

```
1–5 floors
```

---

# Building Appearance

Buildings should resemble the reference screenshots.

Not skyscrapers.

Instead they should look like:

- Dungeon walls
- Small apartment blocks
- Warehouses
- Rooftop structures

Each rooftop can randomly contain:

- Water tanks
- Air conditioners
- Satellite dishes
- Chimneys
- Small vents
- Storage boxes

Every rooftop should look unique.

---

# Building Texture Rules

Textures are generated entirely using the Canvas API.

Every façade includes:

- Brick pattern
- Window grid
- Shadow pixels
- Roof trim
- Dark outlines
- Random pixel noise

No PNG textures.

No external assets.

Everything procedural.

---

# Building Shapes

Allowed procedural shapes:

- Cube
- Rectangle
- L-shape
- Corner building
- Tall tower
- Warehouse
- Apartment block

Flat roofs only.

---

# Roads

Roads are one tile wide.

Appearance:

- Flat planes
- Pixel texture
- Dark outline
- Center dashed markings

Intersections are darker square tiles.

Roads resemble dungeon corridors.

---

# Vehicle Design

Vehicles follow the same pixel-art style.

Inspired by:

- Zelda overworld sprites
- Pokémon vehicles
- Tiny Game Boy objects

Construction:

- BoxGeometry body
- BoxGeometry cabin
- Cylinder wheels

Everything outlined.

---

# Vehicle Palette

Body

```
#7A7772
```

Windows

```
#B8B4A7
```

Roof

```
#44413F
```

Outline

```
#262626
```

Optional random features:

- Roof rack
- Taxi sign
- Police light
- Cargo box
- Antenna

---

# Vehicle Animation

Movement:

- Smooth linear motion
- Slight bobbing
- Wheel rotation
- Smooth turning

No drifting.

No physics simulation.

---

# Path Visualization

The algorithm visualization should appear directly on roads.

Explored roads

- Light overlay

Current frontier

- Pulsing tile

Final path

- Dark highlighted corridor

Vehicle follows only the final path.

---

# Start Marker

Tiny pixel flag.

Dark outline.

Slow pulse animation.

---

# Goal Marker

Pixel treasure chest style marker.

Dark outline.

Small idle bounce.

---

# Selection Cursor

Hovering a road displays:

```
┌     ┐

└     ┘
```

Only corner brackets.

Exactly like the provided references.

No filled square.

---

# Buttons

Buttons resemble handheld RPG menus.

States:

Idle

Pressed

Disabled

Pressed buttons shift downward by 2 pixels.

---

# Icons

Only pixel icons.

Examples

- Car
- Building
- Flag
- Map
- Gear
- Compass
- Road

No SVG icon libraries.

Everything pixelated.

---

# Minimap

Located in the upper-right corner.

Displays:

- Buildings
- Roads
- Vehicle
- Goal
- Current path

Optional fog of war.

The minimap should closely resemble the dungeon map shown in the reference images.

---

# Lighting

Lighting should remain extremely simple.

Use:

- One directional light
- Soft ambient light

Do not use:

- HDR
- Bloom
- Reflections
- PBR materials
- Screen-space effects

Flat shading only.

---

# Outline Rendering

Every object must have a dark outline.

Including:

- Buildings
- Roads
- Vehicles
- Props
- Markers

Outlines are one of the defining characteristics of the art style.

---

# Decorative Props

Random procedural props improve city variety.

Examples:

- Street lamps
- Trees
- Benches
- Mailboxes
- Crates
- Barrels
- Fire hydrants
- Road signs
- Water tanks

All generated procedurally.

---

# Animations

Keep animations subtle.

Allowed:

- Vehicle movement
- Camera follow
- Cursor blink
- Button press
- Tile pulse

Avoid excessive motion.

The world should feel calm and readable.

---

# Asset Rules

Everything must be generated procedurally.

Allowed:

- Three.js primitives
- Canvas-generated textures
- Shader materials
- Geometry instancing

Not allowed:

- PNG textures
- GLTF models
- FBX assets
- Downloaded sprites
- External icon packs

---

# Overall Goal

The application should feel like a forgotten Game Boy strategy game where a miniature procedural city replaces a dungeon.

Rather than a modern pathfinding visualizer, users should feel as if they are exploring an interactive retro arcade world with tiny pixel buildings, simple vehicles, and animated algorithm exploration.

Every visual element should reinforce the illusion that the player is navigating a handcrafted monochrome adventure game built entirely from procedural geometry and pixel-art textures.