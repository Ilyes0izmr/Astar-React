import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import TerrainLayers from "./TerrainLayers"; 

/**
 * a react component that calculates the shortest path using the A* algorithm.
 * the A* star algorithm is slightly different here : where F = H + cost (it doesnt calculate the g cost)
 * 
 * @component
 * @param {number[][]} props.matrix - a 2D matrix representing the grid`s ID that we use to determine the cell type (wall , grass ... ) 
 * 
 * @param {Object} [props.grid] - object that is representing the grid structure, it does contain teh following :                        
 *                                - {number[][]} matrix - A 2D array where each cell represents a different block in the grid, where each cell contains:
 *                                  - {number} id - the identifier for the block type.
 *                                  - {number} neighbor - a single value representing the neighbor of the block.
 * @see Terrain.jsx - for more details on how is the id and the nieghbor value is assigned
 *       
 * @param {number} props.energyBar - a value represent the initial energy value
 * 
 * @param {Point} props.start - the starting coordinates , given in a pair element (array of 2 elemenet X and Y )
 * @param {Point} props.destination - the destination coordinates , given in a pair element (array of 2 elemenet X and Y )
 * @returns {JSX.Element} - Returns a React element that calculates the path and call another component to display it 
 * 
 * @see TerrainLayers.jsx - for more information about how th egrid is displayed 
 */
const ASTAR = ({ matrix, grid, energyBar, start, destination }) => {
  const size = matrix.length;
  const [path, setPath] = useState([]);                     // thpath between teh starting point and the destination 
  const [energyStates, setEnergyStates] = useState([]);     // New state to track energy levels (so i can pass it into the terrainLayers componenet to animate it) //TODO: i need to find better approuche for this website ? 
  const [outOfEnergy, setOutOfEnergy] = useState(false);    // out of energy indicator (OLD approach) 
  const [isComplete, setIsComplete] = useState(false);      //TODO: to check if the path is completed or not (OLD approach) || i need to change this for better display 
  //const [isInvalid, setIsInvalid] = useState(false);        //TODO: also old approache i might as well delete it  ?
  //const [triggerUpdate, setTriggerUpdate] = useState(false); //TODO: foerce rerender ?? || i need to remove it ig no need for it 


  /** 
   * function to check if the given cell is valid or not 
   *  cell is set to be valid if it is not out of boundries && it is not a wall 
   * 
   * @param {number} row 
   * @param {number} col 
   * @returns 
   */
  const isValidCell = (row, col) => {
    return (row >= 0) &&      
           (row < size) && 
           (col >= 0) && 
           (col < size) && 
           (matrix[row][col] !== 1);
  };

  /** 
   * function that returns the cost of a cell 
   * 
   * @param {number} cellValue - the cell`s id  
   * @returns {number} - represents the cost value of passing through that cell ()
   * @note the values are swaps beacause it is called after a minus (+) opertator
   */
  const getCost = (cellValue) => {
    switch (cellValue) {
      case 0: return 0;
      case 2: return -1;
      case 3: return 2;
      case 4: return 3;
      default: return 0;
    }
  };

  /** 
   * fucntion that return the manhattan distance between two cells 
   * 
   * @param {number} r1   
   * @param {number} c1 
   * @param {number} r2 
   * @param {number} c2 
   * @note : 1 : coordinations of the current cell 
   *         2 : coordiantions of the target cell (in our case it is the destination )
   * @see {@link https://en.wikipedia.org/wiki/Taxicab_geometry}
   * @see {@link https://www.geeksforgeeks.org/calculate-the-manhattan-distance-between-two-cells-of-given-2d-array/}
   * @see {@link https://www.datacamp.com/tutorial/manhattan-distance}
   * @returns 
   */
  const manhattanDistance = (r1, c1, r2, c2) => {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
  };

  /**
   * the funtion return the best path possible
   * 
   * @param {number} row   -of the current position  to start search from 
   * @param {number} column -of the current positino to start search from 
   * @param {number} remainingEnergy -the reminig energy 
   * @param {Array<[]>} pair -of coordinations that show the path 
   * @param {Bollean[][]} visited -to keep track of the cels visited alreay 
   * @param {number} skullCount -to help us count the skull number to avoid the condition of steping over two skulls in a row
   *                            -@note you can get rid of this since it is just an extra condition for the maze logic 
   * @param {Array<number>} energyLog  - to track the energy changes to match it with the path while animatig the path 
   * @returns {Array<[number,number]>} -the shortest path between two points start and destination  directed by coordinations 
   * 
   * @see {@link ttps://www.geeksforgeeks.org/backtracking-algorithms/}
   * @note : we migh consider that we use a priority queue since it is the best solution for this type of problems 
   * @see {@link https://www.redblobgames.com/pathfinding/a-star/implementation.html} - for the priority queue implemetnation (provided in python ig )
   * 
   */
  const findPath = (row, col, remainingEnergy, currentPath = [], visited = null, skullCount = 0, energyLog = []) => {
    if (!visited) {
      visited = Array.from({ length: size }, () => Array(size).fill(false)); // inilize the visited matrix  with false 
    }

    energyLog.push(remainingEnergy); // push the energy state 

    if (matrix[row][col] === 6) {    //base case : we found the destination 
      return [...currentPath, [row, col]];
    }
    
    //another base case : we need to check if there is energy left or is this valid cell 
    //@todo : verify this for the future                     
    if (!isValidCell(row, col) || remainingEnergy < 0) {
      return null;
    }

    currentPath.push([row, col]); //push the cell
    visited[row][col] = true;     //mark it as visited 

    const cost = getCost(matrix[row][col]);   //get the cose 
    const newEnergy = remainingEnergy - cost; //calculat the new energy 

    if (newEnergy < 0) {  //if the energy is less thatn 0 we stop ====> out of energy
      setOutOfEnergy(true);
      return null;
    }

    if (matrix[row][col] === 4) { //skull condition : cant hit two in a row 
      skullCount++;
    } else {
      skullCount = 0;
    }
    if (skullCount >= 2) {
      //setIsInvalid(true); // we might remove this 
      return null;
    }

    let neighbors = [
      [row - 1, col],
      [row, col + 1],
      [row + 1, col],
      [row, col - 1],
    ];

    //calculate the cost and the manhattain destance 
    
    let validDirections = neighbors.filter(([r, c]) => isValidCell(r, c) && !visited[r][c]); //filter them based on the availability 
    validDirections.sort((a, b) => { // sort them by the totoal cost F 
      const hA = manhattanDistance(a[0], a[1], destination[0], destination[1]) + getCost(matrix[a[0]][a[1]]);
      const hB = manhattanDistance(b[0], b[1], destination[0], destination[1]) + getCost(matrix[b[0]][b[1]]);
      return hA - hB;
    });
    // redo the backtraking [this approuche is ig a little bit better and faster than not sorting ] 
    for (const [nextRow, nextCol] of validDirections) {
      const result = findPath(nextRow, nextCol, newEnergy, [...currentPath], visited, skullCount, energyLog);
      if (result) {
        return result;
      }
    }

    currentPath.pop();
    return null;
  };

  useEffect(() => {
    const findAndAnimatePath = async () => {
      const energyLog = []; //inilize the energy log 
      const result = findPath(start[0], start[1], energyBar, [], null, 0, energyLog); // call teh find path 

      if (result) { 
        setPath(result); // set the path to the obtained result 
        setEnergyStates(energyLog); // store teh energy level
        setIsComplete(matrix[result[result.length - 1][0]][result[result.length - 1][1]] === 6); //if the last cell inn hte  path isnt the 6 that means we didnt reach the ned 

        //todo : i need to change this it is baaad 
        for (let i = 1; i < result.length - 2; i++) {
          const [row, col] = result[i];
          await new Promise((resolve) => setTimeout(resolve, 500)); 
          grid[row][col].id = 7;
          grid[row][col].neighbor = 0;
          //setTriggerUpdate((prev) => !prev); // force React to detect the change
        }
      } else {
        setPath([]);
        setEnergyStates([]); 
        setIsComplete(false);
      }
    };
    findAndAnimatePath();
  }, [matrix, energyBar, start, destination]);

  return (
    <div>
      <h2>Path:</h2>
      <p>{/*path.map(([r, c], index) => `(${r},${c}) [Energy: ${energyStates[index]}]`).join(" → ")*/}</p>
      {/*outOfEnergy && <p> Out of energy!</p>*/}
      {/*isComplete && <p>Path found!</p>*/}
      {/*isInvalid && <p>Invalid path (Hit two skulls in a row)</p>*/}

      <TerrainLayers grid={grid} path={path.slice(1, -1)} energyStates={energyStates} />
    </div>
  );
};

ASTAR.propTypes = {
  matrix: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  grid: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        neighbor: PropTypes.number.isRequired,
      })
    )
  ).isRequired,
  energyBar: PropTypes.number.isRequired,
  start: PropTypes.arrayOf(PropTypes.number).isRequired,
  destination: PropTypes.arrayOf(PropTypes.number).isRequired,
};

export default ASTAR;