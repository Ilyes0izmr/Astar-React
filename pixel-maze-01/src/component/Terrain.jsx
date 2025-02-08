import { useState, useEffect } from "react";
import "./Terrain.css";
import TerrainLayers from "./TerrainLayers";

const Terrain = () => {
    const size = 15; // Grid size
    const [grid, setGrid] = useState([]);

    useEffect(() => {
        const generateGrid = () => {
            let newMatrix = Array.from({ length: size }, () =>
                Array.from({ length: size }, () => ({
                    id: 0,
                    neighbors: {},
                    notNeighbor: "X",
                }))
            );

            const staticPattern = [
                [1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            ];

            // Assign IDs based on static pattern
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    newMatrix[row][col].id = staticPattern[row][col];
                }
            }

            // Calculate neighbors and check diagonal differences
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const currentId = newMatrix[row][col].id;

                    // Assign cardinal neighbors
                    newMatrix[row][col].neighbors = {
                        up: row > 0 ? newMatrix[row - 1][col].id : 0,
                        down: row < size - 1 ? newMatrix[row + 1][col].id : 0,
                        left: col > 0 ? newMatrix[row][col - 1].id : 0,
                        right: col < size - 1 ? newMatrix[row][col + 1].id : 0,
                    };

                    // Check if all cardinal neighbors are the same
                    const allCardinalNeighborsSame =
                        newMatrix[row][col].neighbors.up === currentId &&
                        newMatrix[row][col].neighbors.down === currentId &&
                        newMatrix[row][col].neighbors.left === currentId &&
                        newMatrix[row][col].neighbors.right === currentId;

                    if (allCardinalNeighborsSame) {
                        const diagonalNeighbors = [
                            { row: row - 1, col: col - 1, label: "TL" },
                            { row: row - 1, col: col + 1, label: "TR" },
                            { row: row + 1, col: col - 1, label: "BL" },
                            { row: row + 1, col: col + 1, label: "BR" },
                        ];

                        let notNeighborLabel = "X"; // Default value

                        for (const { row: dRow, col: dCol, label } of diagonalNeighbors) {
                            if (
                                dRow >= 0 &&
                                dRow < size &&
                                dCol >= 0 &&
                                dCol < size &&
                                newMatrix[dRow][dCol].id !== currentId
                            ) {
                                notNeighborLabel = label; // Set to specific diagonal label
                                break;
                            }
                        }

                        newMatrix[row][col].notNeighbor = notNeighborLabel;
                    } else {
                        newMatrix[row][col].notNeighbor = "X";
                    }
                }
            }

            setGrid(newMatrix);
        };

        generateGrid();
    }, []);

    return (
        <div>
            <h2>Terrain</h2>
            <TerrainLayers grid={grid} />
        </div>
    );
};

export default Terrain;