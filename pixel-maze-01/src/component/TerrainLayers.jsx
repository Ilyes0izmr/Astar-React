import { useState, useEffect } from "react";
import PropTypes from "prop-types";

const TerrainLayers = ({ grid }) => {
  const [imagePaths, setImagePaths] = useState({});

  
  const getColor = (id) => {
    switch (id) {
      case 0:
        return "rgb(56,216,142)" 
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

  
  const getImageName = (id, neighbor) => {
    return `${id}${neighbor}`; 
  };

  
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

  return (
    <div className="grid-container">
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="grid-row">
          {row.map((cell, colIndex) => {
            const imageName = getImageName(cell.id, cell.neighbor); 
            const imagePath = imagePaths[imageName];
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="grid-cell"
                style={{ backgroundColor: getColor(cell.id) }}
                title={`ID: ${cell.id}, Neighbor: ${cell.neighbor}`}
              >
                
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
                      objectFit: "cover", 
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


TerrainLayers.propTypes = {
  grid: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired, 
        neighbor: PropTypes.number, 
      })
    ).isRequired
  ).isRequired,
};

export default TerrainLayers;