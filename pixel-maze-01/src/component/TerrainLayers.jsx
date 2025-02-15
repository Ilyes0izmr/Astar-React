import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Path from "../assets/70.png"; // Import the path marker image

const TerrainLayers = ({ grid, path }) => {
  const [imagePaths, setImagePaths] = useState({});
  const [animatedPath, setAnimatedPath] = useState([]); // Track the animated path
 

  // Function to get the image name based on cell ID and neighbor
  const getImageName = (id, neighbor) => {
    return `${id}${neighbor}`;
  };

  // Function to get the content for a cell (image or background color)
  const getCellContent = (id, rowIndex, colIndex, neighbor) => {
    // Check if the cell is part of the animated path
    const isAnimatedPathCell = animatedPath.some(([r, c]) => r === rowIndex && c === colIndex);

    if (isAnimatedPathCell) {
      // Return the path marker image (70.png) for animated path cells
      return (
        <img
          src={Path} // Path to your path marker image
          alt="Path marker"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            objectFit: "cover",
          }}
        />
      );
    }

    // Default behavior: return the terrain image
    const imageName = getImageName(id, neighbor);
    const imagePath = imagePaths[imageName];
    if (imagePath) {
      return (
        <img
          src={imagePath}
          alt={`Terrain overlay for ${imageName}`}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            objectFit: "cover",
          }}
        />
      );
    }

    // Fallback: return a background color
    switch (id) {
      case 0:
        return "rgb(56,216,142)";
      case 1:
        return "#c0d470";
      case 2:
        return "#e8cfa6";
      case 3:
        return "#9bd4c3";
      default:
        return "white";
    }
  };

  // Load images dynamically
  useEffect(() => {
    const loadImages = async () => {
      const paths = {};
      for (let row of grid) {
        for (let cell of row) {
          if (cell.id === 0 && !cell.neighbor) {
            const randomNeighbor = Math.floor(Math.random() * 4);
            cell.neighbor = randomNeighbor;
          }

          const imageName = getImageName(cell.id, cell.neighbor);
          if (!paths[imageName]) {
            try {
              const module = await import(`../assets/${imageName}.png`);
              paths[imageName] = module.default;
            } catch (error) {
              console.error(`Failed to load image: ${imageName}.png`, error);
              paths[imageName] = null;
            }
          }
        }
      }
      setImagePaths(paths);
    };
    loadImages();
  }, [grid]);

  // Animate the path step-by-step
  useEffect(() => {
    if (path.length > 0) {
      const animate = async () => {
        for (let i = 0; i < path.length; i++) {
          setAnimatedPath((prev) => [...prev, path[i]]); // Add the next step to the animated path
          await new Promise((resolve) => setTimeout(resolve, 500)); // Delay for 500ms
        }
      };
      animate();
    }
  }, [path]);

  return (
    <div className="grid-container">
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="grid-row">
          {row.map((cell, colIndex) => {
            const cellContent = getCellContent(cell.id, rowIndex, colIndex, cell.neighbor);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="grid-cell"
                style={{
                  backgroundColor: typeof cellContent === "string" ? cellContent : "transparent",
                  position: "relative",
                }}
                title={`ID: ${cell.id}, Neighbor: ${cell.neighbor}`}
              >
                {cellContent}
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
        neighbor: PropTypes.number,
      })
    ).isRequired
  ).isRequired,
  path: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
};

export default TerrainLayers;