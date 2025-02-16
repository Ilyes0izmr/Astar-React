import { useState, useEffect } from "react";
import PropTypes from "prop-types";

import Path from "../assets/70.png";                 //the path image 
import Heart from "../assets/heart.png";             // the energy bar  
import BlackHeart from "../assets/black_heart.png";  //no energy 

const TerrainLayers = ({ grid, path, energyStates }) => {
  const [imagePaths, setImagePaths] = useState({});      
  const [animatedPath, setAnimatedPath] = useState([]); // Track the animated path
  const [healthIndicators, setHealthIndicators] = useState([]); // Track health indicators
  const [noEnergyLeft, setNoEnergyLeft] = useState(false); // Track if energy runs out
  const [noPathFound, setNoPathFound] = useState(false); // Track if no path is found

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

  // Animate the path step-by-step and update health indicators in parallel
  useEffect(() => {
    // Reset states before starting the animation
    setNoEnergyLeft(false);
    setNoPathFound(false);

    // Check if the path is empty
    if (path.length === 0) {
      setNoPathFound(true); // No path found
      return;
    }

    if (energyStates.length > 0) {
      const animate = async () => {
        for (let i = 0; i < path.length; i++) {
          const currentEnergy = energyStates[i];

          // Stop animation if energy runs out
          if (currentEnergy <= 0) {
            setNoEnergyLeft(true);
            break;
          }

          // Update the animated path
          setAnimatedPath((prev) => [...prev, path[i]]);

          // Update the health indicators based on the current energy level
          const maxHealth = energyStates[0]; // Initial energy level
          const newHealthIndicators = Array.from({ length: maxHealth }, (_, index) =>
            index < currentEnergy ? Heart : BlackHeart
          );

          setHealthIndicators(newHealthIndicators);

          // Wait for 500ms before moving to the next step
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      };

      animate();
    }
  }, [path, energyStates]);

  return (
    <div className="grid-container">
      {/* Display messages */}
      {noEnergyLeft && <p style={{ textAlign: "center", color: "red" }}>❌ No energy left!</p>}
      {noPathFound && <p style={{ textAlign: "center", color: "red" }}>❌ No path found!</p>}

      {/* Render health indicators */}
      {!noEnergyLeft && !noPathFound && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "10px",
          }}
        >
          {healthIndicators.map((indicator, index) => (
            <img
              key={index}
              src={indicator}
              alt={indicator === Heart ? "Heart" : "Black Heart"}
              style={{
                width: "20px",
                height: "20px",
                margin: "0 5px",
              }}
            />
          ))}
        </div>
      )}

      {/* Render the grid */}
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
  energyStates: PropTypes.arrayOf(PropTypes.number).isRequired,
};

export default TerrainLayers;