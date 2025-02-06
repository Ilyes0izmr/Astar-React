import { useState, useEffect } from "react";
import "./Terrain.css";
import TerrainLayers from "./TerrainLayers"; // Import the new component

const Terrain = () => {
    const size = 15;
    const [grid, setGrid] = useState([]);

    useEffect(() => {
        const generateGrid = () => {
            // Initialize the grid with objects
            let newMatrix = Array.from({ length: size }, () =>
                Array.from({ length: size }, () => ({
                    id: 0, // Start with 0, we will update this for each 3x3 block
                    neighbors: {} // Neighbors will be assigned later
                }))
            );

            // assign the same value (id) for each 3x3 block
            for (let i = 0; i < size; i += 3) {
                for (let j = 0; j < size; j += 3) {
                    const value = Math.floor(Math.random() * 3) + 1; // random 1, 2, or 3 for the block id
                    for (let x = 0; x < 3; x++) {
                        for (let y = 0; y < 3; y++) {
                            if (i + x < size && j + y < size) {
                                newMatrix[i + x][j + y].id = value;
                            }
                        }
                    }
                }
            }

            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    newMatrix[row][col].neighbors = {
                        up: row > 0 ? newMatrix[row - 1][col].id : null,
                        down: row < size - 1 ? newMatrix[row + 1][col].id : null,
                        left: col > 0 ? newMatrix[row][col - 1].id : null,
                        right: col < size - 1 ? newMatrix[row][col + 1].id : null,
                    };
                }
            }

            setGrid(newMatrix);
        };

        generateGrid();
    }, []);

    return (
        <div>
            <h2>Grid Visualization</h2>
            <TerrainLayers grid={grid} /> {/* Pass the grid to the new component */}
        </div>
    );
};

export default Terrain;


