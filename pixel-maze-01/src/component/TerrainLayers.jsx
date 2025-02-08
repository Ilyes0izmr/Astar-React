import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const TerrainLayers = ({ grid }) => {
  const [imagePaths, setImagePaths] = useState({});

  
  const getColor = (id) => {
    switch (id) {
      case 1:  return "#9bd4c3"; // grass c0d470
      case 2:  return "#e8cfa6"; // dirt  e8cfa6
      case 3:  return "#9bd4c3"; // Water 9bd4c3
      default: return "white"; // Default color
    }
  };

  
  const getImageName = (id, neighbors , notNeighbor) => {
    const { up, down, right, left } = neighbors;
    return `${id || 0}${up || 0}${down || 0}${left || 0}${right || 0}${notNeighbor}`;
  };

  
  useEffect(() => {
    const loadImages = async () => {
      const paths = {};
      for (let row of grid) {
        for (let cell of row) {
          const imageName = getImageName(cell.id, cell.neighbors, cell.notNeighbor);
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

  return (
    <div className="grid-container">
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="grid-row">
          {row.map((cell, colIndex) => {
            const imageName = getImageName(cell.id, cell.neighbors , cell.notNeighbor);
            const imagePath = imagePaths[imageName];
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="grid-cell"
                style={{ backgroundColor: getColor(cell.id) }}
                title={`ID: ${cell.id}, Neighbors: ${JSON.stringify(cell.neighbors)} ,Diagonal : ${cell.notNeighbor}`}
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
          left: PropTypes.number,
        }).isRequired,
      })
    ).isRequired
  ).isRequired,
};

export default TerrainLayers;