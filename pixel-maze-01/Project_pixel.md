# Pixel Maze: Pathfinding & Procedural City Generator

![Hero Image Placeholder](/path/to/hero_image.png)

Welcome to **Pixel Maze**, an interactive, visually striking pathfinding visualizer built on top of a procedurally generated pixel-art city. This project merges computer science algorithm demonstrations with a dynamic, living environment, allowing users to watch pathfinding algorithms navigate through streets, overcome hazards, and reach their goals in real-time.

---

## 🛠 Tech Stack

![Tech Stack Image Placeholder](/path/to/tech_stack_image.png)

- **Frontend Framework**: React (with Hooks for state management)
- **Rendering Engine**: HTML5 `<canvas>` API (custom pixel-art rendering loop)
- **Build Tool**: Vite (for fast HMR and optimized production builds)
- **Styling**: Vanilla CSS (tailored for strict Neo-Brutalism aesthetics)

---

## 🎨 Design Approach: Neo-Brutalism

![Neo-Brutalism UI Placeholder](/path/to/neo_brutalism_image.png)

The user interface strictly adheres to **Neo-Brutalism** principles. This design philosophy emphasizes:
- **Raw & Bold Aesthetics**: Thick, hard-edged borders (heavy strokes) and stark shadows instead of soft drop-shadows.
- **High Contrast**: Solid, unapologetic background colors that clash intentionally but harmoniously.
- **Utilitarian Typography**: Highly legible, bold sans-serif fonts that prioritize function while maintaining a distinct modern edge.
- **Micro-Animations**: Snappy, rigid transitions that give the interface a mechanical, tactile feel.

---

## 🌈 Color Theme & UI

The application features a dynamic color palette that responds to the in-game time of day (Dawn, Noon, Dusk, Night) and weather conditions (Clear, Rain, Snow, Rainbow).

### Visual Modes

| Day Mode | Night Mode |
| :---: | :---: |
| ![Day Placeholder](/path/to/day_mode.png) | ![Night Placeholder](/path/to/night_mode.png) |
| **Retro (Monochrome)** | **Colored (Rainbow)** |
| ![Retro Placeholder](/path/to/retro_mode.png) | ![Colored Placeholder](/path/to/colored_mode.png) |

The UI itself utilizes a carefully curated brutalist color scheme:
- **Primary Accents**: Vibrant, high-visibility colors (like harsh yellows or stark whites) for active algorithms and buttons.
- **Neutrals**: Deep blacks and off-whites for structural elements, ensuring the canvas remains the focal point.
- **Interactive Elements**: Buttons and sliders feature heavy black outlines and solid block shadows that shift upon click, simulating physical mechanical switches.

---

## 🧠 Pathfinding Algorithms

![Algorithms Image Placeholder](/path/to/algorithms_image.png)

At the core of the project is the visualization of classic graph traversal algorithms. Users can draw start and end points, place hazards or obstacles, and watch the algorithms work:

- **A* (A-Star) Search**: The optimal heuristic-based algorithm. Uses Manhattan distance to intelligently pull the search toward the goal, finding the shortest path while exploring the fewest nodes possible.
- **Dijkstra's Algorithm**: The father of pathfinding. Explores equally in all directions, guaranteeing the shortest path but at the cost of higher exploration time.
- **Greedy Best-First Search**: Highly aggressive, exploring solely based on the heuristic to the goal. It is extremely fast but does not guarantee the shortest path.
- **Breadth-First Search (BFS)**: Unweighted exploration that expands outward like a ripple.
- **Depth-First Search (DFS)**: Dives as deep as possible before backtracking. Rarely yields an optimal path, but fascinating to watch.

The map includes varying "terrain costs" (e.g., roads vs. hazards like rubble and spikes), which algorithms like A* and Dijkstra take into account when calculating the cheapest fuel cost to the destination.

---

## 🏙️ Procedural Generation & The Maze

![Procedural City Placeholder](/path/to/procedural_city_image.png)

The environment isn't just a static grid; it's a living, breathing procedural city:
- **City Generation**: Utilizing deterministic hash functions and cellular automata rules to carve out natural-looking coastlines, mountain ranges, forests, and urban sprawls.
- **Dynamic Elements**: The city features moving vehicles on roads, pedestrians, and animals.
- **Train Station**: A specially carved, untouchable zone where the railway tracks pass through the city, adding structural landmarks to the procedural generation.

### 🖌️ Edit Your Own Map

![Map Editing Placeholder](/path/to/map_editing_image.png)

Users aren't limited to the procedurally generated city! You have full control to **edit the map yourself**:
- Use the built-in painting tools to draw new roads, erase structures, or build solid walls.
- Place interactive hazards (like rubble or spikes) that alter the terrain weight for algorithms.
- Dynamically watch how paths reroute instantly as you manipulate the environment in real-time.

---

*Explore, draw, and watch the algorithms come to life.*
