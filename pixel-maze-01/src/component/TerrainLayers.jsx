import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Path from "../assets/70.png";                 //the path image 
import Heart from "../assets/heart.png";             // the energy bar  
import BlackHeart from "../assets/black_heart.png";  //no energy 


/**
 * this component does the visualization part and the animation (it suppose in the future hh )
 * 
 * @component
 *
 * @param {Object} [props.grid] - object that is representing the grid structure, it does contain teh following :                        
 *                                - {number[][]} matrix - A 2D array where each cell represents a different block in the grid, where each cell contains:
 *                                  - {number} id - the identifier for the block type.
 *                                  - {number} neighbor - a single value representing the neighbor of the block.
 * @see Terrain.jsx - for more details on how is the id and the nieghbor value is assigned
 * 
 * @param {array<[number,number]>} props.path coordination of the  path 
 * @param {number} props.energyStates - a value represent the initial energy value
 * 
 * @returns {JSX.Element} - Returns a React componenet that renders the visualization 
 * 
 * @see ASTAR.jsx - forn more information on how is hte grid and the path is calculated see this 
 * 
 * @note : i need to fix this component 
 * 1) the style should be in a diff css 
 * 2) the health indicator somtimes does not work
 * 3) sometime they do assign 5 with a nighbor and i dont remmeber i did allow this (hmmmmmmmmmmmmm ) 
 * 
 */
const TerrainLayers = ({ grid, path, energyStates }) => {
  const [imagePaths, setImagePaths] = useState({});        
  const [animatedPath, setAnimatedPath] = useState([]); // tarck the animation path 
  const [healthIndicators, setHealthIndicators] = useState([]); // track health visulazation
  const [noEnergyLeft, setNoEnergyLeft] = useState(false); // to see if the energy is out 
  const [noPathFound, setNoPathFound] = useState(false); // to se if hte path is not found 

  /**
   * 
   * @param {number} id 
   * @param {number} neighbor 
   * @returns {string} the image name to render it   
   */
  const getImageName = (id, neighbor) => {
    return `${id}${neighbor}`;
  };

/**
 * determines the content (image or background color) to display for a grid cell.
 *
 *this functions checks the value of the neighbor and the id to decide waht to dispaly as ana image 
 *
 * @function getCellContent
 * @param {number} id - the ID of the cell, representing teh terrain`s type 
 * @param {number} rowIndex  
 * @param {number} colIndex 
 * @param {number} neighbor 
 * @returns {??} - return either an image or a css style (background color )
 *
 */
  const getCellContent = (id, rowIndex, colIndex, neighbor) => {
    const isAnimatedPathCell = animatedPath.some(([r, c]) => r === rowIndex && c === colIndex); //check if the cell is  a part of the path 
    if (isAnimatedPathCell) { // if yes return 70.png (it is imported )
      return (
        <img
          src={Path}
          alt="valid Path"
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
    
    //otherwise return the image with teh image name  
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
    
    //no valid id ? in case i missed some probabilites they are just alooot of pictures 
    switch (id) {
      case 0: return "rgb(56,216,142)";
      case 1: return "#c0d470";
      case 2: return "#e8cfa6";
      case 3: return "#9bd4c3";
      default: return "white";
    }
  };

  //load the images for teh terrain 
  useEffect(() => {
    const loadImages = async () => {
      const paths = {};
      for (let row of grid) {
        for (let cell of row) {
          if (cell.id === 0 && !cell.neighbor) {  // welll here for better visualzation ,m i have 4 types of blocks for teh grass 
            // so this methode helps me return a random one 
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

  //teh animation part
  useEffect(() => {
    // Reset states before starting the animation
    setNoEnergyLeft(false);
    setNoPathFound(false);
  
    // heck if the path is empty
    if (path.length === 0) {
      setNoPathFound(true); 
      return;
    }
  
    if (energyStates.length > 0) {
      const animate = async () => {
        for (let i = 0; i < path.length; i++) {
          const currentEnergy = energyStates[i];
  
          
          console.log(`Step ${i}: Current Energy = ${currentEnergy}`);
  
          
          if (currentEnergy <= 0) {
            setNoEnergyLeft(true);
            break;
          }
  
          
          setAnimatedPath((prev) => [...prev, path[i]]);
  
          
          const maxHealth = energyStates[0]; 
          const newHealthIndicators = Array.from({ length: maxHealth }, (_, index) =>
            index < currentEnergy ? Heart : BlackHeart
          );
  
          
          console.log(`Step ${i}: Health Indicators =`, newHealthIndicators);
  
          setHealthIndicators(newHealthIndicators);
  
          
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      };
  
      animate();
    }
  }, [path, energyStates]);

  return (
    <div className="grid-container">
      {/* display messages */}
      {noEnergyLeft && <p style={{ textAlign: "center", color: "orange" }}>❌No energy left</p>}
      {noPathFound && <p style={{ textAlign: "center", color: "red" }}>❌No path found</p>}

      {/* eender health indicators */}
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
                width: "50px",
                height: "50px",
                margin: "0 5px",
              }}
            />
          ))}
        </div>
      )}

      {/* render the grid */}
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