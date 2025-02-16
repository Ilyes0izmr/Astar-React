import { useState } from "react";
import "./Terrain.css";
import ASTAR from "./ASTAR";

const Terrain = () => {
    const [start, setStart] = useState(null);
    const [destination, setDestination] = useState(null);
    const [editingMode, setEditingMode] = useState(null); // Tracks what the user is placing
    const [showInitialGrid, setShowInitialGrid] = useState(true);
    const [analyse, setAnalyse] = useState(false);
    const [size , setSize] = useState(15);
    const [grid, setGrid] = useState(() =>
        Array(size)
            .fill()
            .map(() => Array(size).fill({ id: 0, neighbor: 0 }))
    );

    // Randomize the grid while preserving manually placed cells
    const randomizeGrid = () => {
        // Step 1: Create a new randomized grid while preserving manually placed cells
        const newGrid = grid.map((rowArr, rowIndex) =>
            rowArr.map((cell, colIndex) => {
                if (cell.id !== 0) {
                    return cell; // Preserve manually placed cells
                }
                return { ...cell, id: Math.floor(Math.random() * 5) }; // Random ID between 0 and 4
            })
        );
    
        // Step 2: Calculate neighbor values for each cell
        const updatedGrid = newGrid.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
                const currentId = cell.id;
    
                // Define neighbors
                const southNeighbor = rowIdx < size - 1 ? newGrid[rowIdx + 1][colIdx].id : 9;
                const northNeighbor = rowIdx > 0 ? newGrid[rowIdx - 1][colIdx].id : 9;
                const westNeighbor = colIdx > 0 ? newGrid[rowIdx][colIdx - 1].id : 9;
                const eastNeighbor = colIdx < size - 1 ? newGrid[rowIdx][colIdx + 1].id : 9;
                const southWestNeighbor = rowIdx < size - 1 && colIdx > 0 ? newGrid[rowIdx + 1][colIdx - 1].id : 9;
                const southEastNeighbor = rowIdx < size - 1 && colIdx < size - 1 ? newGrid[rowIdx + 1][colIdx + 1].id : 9;
                const northWestNeighbor = rowIdx > 0 && colIdx > 0 ? newGrid[rowIdx - 1][colIdx - 1].id : 9;
                const northEastNeighbor = rowIdx > 0 && colIdx < size - 1 ? newGrid[rowIdx - 1][colIdx + 1].id : 9;
    
                // Logic for assigning neighbor values
                if (currentId === 1) {
                    if (eastNeighbor !== 1 && westNeighbor !== 1 && southNeighbor !== 1 && northNeighbor === 1) {
                        return { ...cell, neighbor: 21 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        southWestNeighbor === 1 &&
                        southEastNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 17 };
                    }
                    if (eastNeighbor !== 1 && southNeighbor === 9) {
                        return { ...cell, neighbor: 20 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor !== 1 &&
                        southNeighbor !== 1 &&
                        northNeighbor === 1 &&
                        southWestNeighbor !== 9
                    ) {
                        return { ...cell, neighbor: 13 };
                    }
                    if (eastNeighbor !== 1 && southNeighbor !== 1) {
                        return { ...cell, neighbor: 15 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor !== 1 &&
                        southNeighbor === 1 &&
                        northNeighbor !== 1 &&
                        southWestNeighbor !== 1 &&
                        northEastNeighbor !== 1 &&
                        northWestNeighbor !== 1 &&
                        southEastNeighbor === 1
                    ) {
                        return { ...cell, neighbor: 9 };
                    }
                    if (
                        eastNeighbor !== 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        southWestNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 14 };
                    }
                    if (
                        eastNeighbor !== 1 &&
                        westNeighbor === 1 &&
                        southNeighbor !== 1 &&
                        northNeighbor === 1 &&
                        southWestNeighbor !== 1 &&
                        northEastNeighbor === 1 &&
                        northWestNeighbor === 1 &&
                        southEastNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 12 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        northNeighbor === 1 &&
                        southWestNeighbor === 1 &&
                        northEastNeighbor !== 1 &&
                        northWestNeighbor !== 1 &&
                        southEastNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 11 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        northNeighbor === 1 &&
                        southWestNeighbor === 1 &&
                        northEastNeighbor === 1 &&
                        northWestNeighbor === 1 &&
                        southEastNeighbor === 1
                    ) {
                        return { ...cell, neighbor: 10 };
                    }
                    if (
                        northNeighbor === 1 &&
                        southNeighbor === 1 &&
                        westNeighbor !== 1 &&
                        westNeighbor !== 9 &&
                        eastNeighbor === 1 &&
                        southEastNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 8 };
                    }
                    if (eastNeighbor === 9 && westNeighbor === 1 && southWestNeighbor !== 1 && southNeighbor === 1) {
                        return { ...cell, neighbor: 4 };
                    }
                    if (eastNeighbor === 1 && westNeighbor === 9 && southEastNeighbor !== 1 && southNeighbor === 1) {
                        return { ...cell, neighbor: 2 };
                    }
                    if (eastNeighbor === 1 && westNeighbor !== 1 && southEastNeighbor !== 1 && southNeighbor === 1) {
                        return { ...cell, neighbor: 22 };
                    }
                    if (
                        northNeighbor === 1 &&
                        southNeighbor === 1 &&
                        westNeighbor !== 9 &&
                        westNeighbor !== 1 &&
                        eastNeighbor === 1
                    ) {
                        return { ...cell, neighbor: 9 };
                    }
                    if (southNeighbor === 1 && westNeighbor !== 9 && westNeighbor !== 1) {
                        return { ...cell, neighbor: 3 };
                    }
                    if (southNeighbor === 9) {
                        return { ...cell, neighbor: 19 };
                    }
                    if (southNeighbor !== 1) {
                        return { ...cell, neighbor: 1 };
                    }
                    if (
                        northNeighbor !== 1 &&
                        eastNeighbor === 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        southEastNeighbor === 1 &&
                        southWestNeighbor === 1
                    ) {
                        return { ...cell, neighbor: 5 };
                    }
                    if (eastNeighbor !== 1 && northNeighbor === 1 && southNeighbor === 1 && westNeighbor !== 1) {
                        return { ...cell, neighbor: 6 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        southEastNeighbor !== 1 &&
                        southWestNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 7 };
                    }
                    if (
                        eastNeighbor === 1 &&
                        westNeighbor === 1 &&
                        southNeighbor === 1 &&
                        southWestNeighbor !== 1
                    ) {
                        return { ...cell, neighbor: 18 };
                    }
                    if (eastNeighbor !== 1) {
                        return { ...cell, neighbor: 16 };
                    }
                }
    
                // Special case for id === 0 with northNeighbor === 1
                if (currentId === 0 && northNeighbor === 1) {
                    return { ...cell, neighbor: 9 };
                }
    
                // Default case: No change to neighbor value
                return cell;
            })
        );
    
        // Step 3: Update the grid state
        setGrid(updatedGrid);
    };

    // Handle cell clicks to place specific items
    const handleCellClick = (row, col) => {
        if (!editingMode) return; // Do nothing if no editing mode is selected

        let newGrid = grid.map((rowArr) => rowArr.map((cell) => ({ ...cell })));

        // Update the clicked cell based on editing mode
        if (editingMode === "start") {
            // Remove previous start point
            if (start) {
                const [prevRow, prevCol] = start;
                newGrid[prevRow][prevCol].id = 0; // Reset previous start point
            }
            newGrid[row][col].id = 5; // Set new start point
            setStart([row, col]);
        } else if (editingMode === "destination") {
            // Remove previous destination point
            if (destination) {
                const [prevRow, prevCol] = destination;
                newGrid[prevRow][prevCol].id = 0; // Reset previous destination point
            }
            newGrid[row][col].id = 6; // Set new destination point
            setDestination([row, col]);
        } else if (editingMode === "coin") {
            newGrid[row][col].id = 2; // Place coin
        } else if (editingMode === "wall") {
            newGrid[row][col].id = 1; // Place wall
        }else if(editingMode === "grass"){
            newGrid[row][col].id = 0; // Place wall
        } else if (editingMode === "mushroom") {
            newGrid[row][col].id = 3; // Place mushroom
        } else if (editingMode === "skull") {
            newGrid[row][col].id = 4; // Place skull
        }
    

        // Update the grid state
        setGrid(newGrid);
    };

    // Clear the entire grid
    const clearGrid = () => {
        // Reset the grid to all empty cells
        const clearedGrid = Array(size)
            .fill()
            .map(() => Array(size).fill({ id: 0, neighbor: 0 }));
        setGrid(clearedGrid);

        // Reset start and destination points
        setStart(null);
        setDestination(null);

        // Exit analysis mode
        setAnalyse(false);
        setShowInitialGrid(true);
    };

    const handleStart = () => {
        if (!start || !destination) {
            alert("Please set both start and destination points before starting!");
            return;
        }
        setAnalyse(true);
        setShowInitialGrid(false);
    };

   
    const handleBuild = () => {     
        setAnalyse(false);
        setShowInitialGrid(true); 
    };

    return (
        <div>
            <h2>Terrain</h2>

           
            <label>
                Select Placement Mode:
                <select
                    value={editingMode || ""}
                    onChange={(e) => setEditingMode(e.target.value || null)}
                    style={{ margin: "10px", padding: "5px" }}
                >
                    <option value="">None</option>
                    <option value="start">Place Starting Point (5)</option>
                    <option value="destination">Place Destination (6)</option>
                    <option value="grass">Place grass (0)</option>
                    <option value="coin">Place Coin (2)</option>
                    <option value="wall">Place Wall (1)</option>
                    <option value="mushroom">Place Mushroom (3)</option>
                    <option value="skull">Place Skull (4)</option>
                    
                </select>
            </label>

            {/* Other buttons */}
            {/*<input type="text" min="15" max="30" value={size} onChange={(e) => setSize(e.target.value)}/>*/}

            <button onClick={handleBuild}>Build</button>
            <button onClick={handleStart}>Run A*</button>
            <button onClick={randomizeGrid}>Randomize Grid</button>
            <button onClick={clearGrid}>Clear Grid</button>
            

            {analyse ? (
                <ASTAR
                    matrix={grid.map(row => row.map(cell => cell.id))}
                    grid={grid}
                    energyBar={10}
                    start={start}
                    destination={destination}
                />
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${size}, 30px)`,
                        gap: "2px",
                        marginTop: "10px",
                    }}
                >
                    {grid.map((row, rowIndex) =>
                        row.map((cell, colIndex) => (
                            <div
                                key={`${rowIndex}-${colIndex}`}
                                onClick={() => handleCellClick(rowIndex, colIndex)} // Make cells clickable
                                style={{
                                    width: "30px",
                                    height: "30px",
                                    border: "1px solid black",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor:
                                        cell.id === 0
                                            ? "white" // Empty
                                            : cell.id === 1
                                            ? "gray" // Wall
                                            : cell.id === 2
                                            ? "gold" // Coin
                                            : cell.id === 3
                                            ? "purple" // Mushroom
                                            : cell.id === 4
                                            ? "black" // Skull
                                            : cell.id === 5
                                            ? "green" // Start
                                            : cell.id === 6
                                            ? "red" // Destination
                                            : "white", // Default
                                    cursor: "pointer", // Make cells interactive
                                }}
                            >
                                {cell.id !== 0 && cell.id !== 1 ? cell.id : ""} {/* Display non-zero, non-gray IDs */}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Terrain;