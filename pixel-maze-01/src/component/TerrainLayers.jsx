import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const TerrainLayers = ({ grid }) => {
    const [imagePaths, setImagePaths] = useState({});

    const getColor = (id) => {
        switch (id) {
            case 1: return "#b47c43"; // Dirt
            case 2: return "#839f54"; // Grass
            case 3: return "#5475bc"; // Water
            default: return "white"; // Default color
        }
    };

    // Function to generate the image name based on neighbors
    const getImageName = (neighbors) => {
        const { up, down, right, left } = neighbors;
        return `i${up || 0}i${down || 0}i${right || 0}i${left || 0}`;
    };

    // Load images dynamically
    useEffect(() => {
        const loadImages = async () => {
            const paths = {};
            for (let row of grid) {
                for (let cell of row) {
                    const imageName = getImageName(cell.neighbors);
                    if (!paths[imageName]) {
                        try {
                            const module = await import(`../assets/${imageName}.png`);
                            paths[imageName] = module.default;
                        } catch (error) {
                            console.error(`Failed to load image: ${imageName}.png`, error);
                            paths[imageName] = null; // Handle missing images
                        }
                    }
                }
            }
            setImagePaths(paths);
        };

        loadImages();
    }, [grid]);

    return (
        <div className="grid-container">
            {grid.map((row, rowIndex) => (
                <div key={rowIndex} className="grid-row">
                    {row.map((cell, colIndex) => {
                        const imageName = getImageName(cell.neighbors);
                        const imagePath = imagePaths[imageName];

                        return (
                            <div
                                key={`${rowIndex}-${colIndex}`}
                                className="grid-cell"
                                style={{ backgroundColor: getColor(cell.id) }}
                                title={`ID: ${cell.id}, Neighbors: ${JSON.stringify(cell.neighbors)}`}
                            >
                                {/* Overlay the image on top of the colored cell */}
                                {imagePath && (
                                    <img
                                        src={imagePath}
                                        alt={`Terrain overlay for ${imageName}`}
                                        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

TerrainLayers.propTypes = {
    grid: PropTypes.arrayOf(
        PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.number.isRequired,
                neighbors: PropTypes.shape({
                    up: PropTypes.number,
                    down: PropTypes.number,
                    right: PropTypes.number,
                    left: PropTypes.number
                }).isRequired
            })
        ).isRequired
    ).isRequired
};

export default TerrainLayers;