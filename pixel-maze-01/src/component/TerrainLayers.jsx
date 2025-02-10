import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const TerrainLayers = ({ grid }) => {
  const [imagePaths, setImagePaths] = useState({});

  // Function to determine the background color based on the cell's ID
  const getColor = (id) => {
    switch (id) {
      case 0:
        return "#ffffff"; // white area
      case 1:
        return "#c0d470"; // grass
      case 2:
        return "#e8cfa6"; // dirt
      case 3:
        return "#9bd4c3"; // water
      default:
        return "white"; // Default color
    }
  };

  // Function to generate the image name based on the cell's ID and neighbor value
  const getImageName = (id, neighbor) => {
    return `${id}${neighbor}`; // Combine ID and neighbor into a string
  };

  // Load images dynamically based on the grid data
  useEffect(() => {
    const loadImages = async () => {
      const paths = {};
      for (let row of grid) {
        for (let cell of row) {
          // Randomly select a neighbor value for cells with id === 0
          if (cell.id === 0 && !cell.neighbor) {
            const randomNeighbor = Math.floor(Math.random() * 5); // Randomly choose 0, 1, or 2
            cell.neighbor = randomNeighbor;
          }

          const imageName = getImageName(cell.id, cell.neighbor);
          if (!paths[imageName]) {
            try {
              const module = await import(`../assets/${imageName}.png`);
              paths[imageName] = module.default;
            } catch (error) {
              console.error(`Failed to load image: ${imageName}.png`, error);
              paths[imageName] = null; // Fallback if image doesn't exist
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
            const imageName = getImageName(cell.id, cell.neighbor); // Use the new logic
            const imagePath = imagePaths[imageName];
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="grid-cell"
                style={{ backgroundColor: getColor(cell.id) }}
                title={`ID: ${cell.id}, Neighbor: ${cell.neighbor}`}
              >
                {/* Render the image if it exists */}
                {imagePath && (
                  <img
                    src={imagePath}
                    alt={`Terrain overlay for ${imageName}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      objectFit: "cover", // Ensure the image covers the cell
                    }}
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

// Define PropTypes to validate the structure of the grid
TerrainLayers.propTypes = {
  grid: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired, // ID of the terrain block
        neighbor: PropTypes.number, // Neighbor value (can be undefined initially)
      })
    ).isRequired
  ).isRequired,
};

export default TerrainLayers;