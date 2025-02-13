import { useEffect, useState } from "react";
import PropTypes from 'prop-types';

const ASTAR = ({ matrix, energyBar, start, destination }) => {
  const size = matrix.length;
  const [path, setPath] = useState([]); // to track the path 
  const [outOfEnergy, setOutOfEnergy] = useState(false); // tracks if we are out of energy 
  const [isComplete, setIsComplete] = useState(false); // track if the path is completed (means we hit the destination)
  //const [remainingEnergy, setRemainingEnergy] = useState(energyBar); // tracks remaining energy

  /**
   * Checks if a cell is valid
   * @param {number} row - row index of the cell
   * @param {number} col - column index of the cell
   * @returns {boolean} - true if the cell is valid, false otherwise
   */
  const isValidCell = (row, col) => {
    return (
      row >= 0 && row < size && col >= 0 && col < size && matrix[row][col] !== 1 // 1 represents a wall
    );
  };

  /**
   * calculates the energy cost of a cell
   * @param {number} cellValue - value of the cell
   * @returns {number} - energy cost of the cell
   */
  const getCost = (cellValue) => {
    switch (cellValue) {
      case 0: return 0; // costs nothing
      case 2: return 1; // ccosts 1 energy for carrying a coin
      case 3: return 2; // csts 2 energy for killing a mushroom
      case 4: return 3; // costs 3 energy for killing a monster
      default: return 0; // costs nothing
    }
  };

  /**
   * calculates the Manhattan distance
   * @param {number} nextRow - row index of the next cell
   * @param {number} nextCol - column index of the next cell
   * @param {number} destRow - row index of the destination
   * @param {number} destCol -column index of the destination
   * @returns {number} - manhattan distance
   */
  const manhattanDistance = (nextRow, nextCol, destRow, destCol) => {
    return Math.abs(nextRow - destRow) + Math.abs(nextCol - destCol);
  };

  /**
   * finds the path using A* algorithm
   * @param {number} row - Current row index
   * @param {number} col - Current column index
   * @param {number} energy - initial energy
   * @param {Array} currentPath - current path being explored
   * @param {number} remainingEnergy - remaining energy
   * @param {Array} visited - visited matrix
   * @returns {Array|null} - the path if found, otherwise null
   */
  const findPath = ( row,col,energy,currentPath = [],remainingEnergy = energy,visited = []) => {
    /*inilize the visited array with false  */
    if (visited.length === 0) {
      for (let i = 0; i < matrix.length; i++) {
        visited[i] = new Array(matrix[0].length).fill(false);
      }
    }

    /*BASE CASE : reach the distination 6*/ 
    if (matrix[row][col] === 6) {
        return [...currentPath, [row, col]]; // return the path
    }

    /* we check if the cell is valid OR if we still have enough energy to move*/
    if (!isValidCell(row, col) || remainingEnergy < 0) {
        return null;
    }

    currentPath.push([row, col]);
    visited[row][col] = true;

    /*calculate the cost of the current cell and upadte remaining energy*/
    const cost = getCost(matrix[row][col]);
    const newEnergy = remainingEnergy - cost;

    /*if we run out of energy we stop the search*/
    if (newEnergy < 0) {
        setOutOfEnergy(true);
        return null;
    }

    /*we get the neighbors :*/ 
    const neighbors = [
        [row-1,col],      // north
        [row, col+1],     // east
        [row+1, col],     // south
        [row, col-1],     // west
    ];

    // now we filter the neighbiors [we only keep those who are valid and not visited yet]
    let validDirections = neighbors.filter(([rows, cols]) =>
        isValidCell(rows, cols) && !visited[rows][cols]
    );

    /*WHAT IF WE HAVE A SKULL : the game rule is defined as we cannot pass through 2 skulls (we will find the rules in the rule page )*/
    // we get the value of the last visited cell and chekc if it is a skull 
    const lastVisited = currentPath[currentPath.length - 2]; 
    if (lastVisited && matrix[lastVisited[0]][lastVisited[1]] === 4) {
        validDirections = validDirections.filter(([rows, cols]) => 
            matrix[rows][cols] !== 4
      );
    }

    /*CHECK 01 : if ther is no valid neighbor we go back  */
    if (validDirections.length === 0) {
      /*visited[row][col] = true;   //.//////////////////////.*/
      currentPath.pop();            // remove the current cell from the path
      return null;                  // backtrack 
    }

    // find the best neighbor
    let minValue = Infinity;
    let bestNeighbor = null;

    for (const [rows, cols] of validDirections) {
      const H = manhattanDistance(rows, cols, destination[0], destination[1]); // heuristic 
      const cost = getCost(matrix[rows][cols]);  //  cost of the cell 
      const total = H + cost;                    //  total cost

      if (total < minValue) {
        minValue = total;
        bestNeighbor = [rows, cols];
      }
    }

    // go through the bets neighbor 
    if (bestNeighbor) {
      const nextRow = bestNeighbor[0];
      const nextCol = bestNeighbor[1];
      const result = findPath( nextRow, nextCol, energy, [...currentPath], newEnergy, visited);
      if (result) {
            return result; 
      }
    }

    // backtrack: remove the current cell from the path and unmark it as visited
    //visited[row][col] = false;
    currentPath.pop();
    return null; // No path found
  };

  
  useEffect(() => {
    const result = findPath(start[0], start[1], energyBar);
    if (result) {
        setPath(result); 
        setIsComplete(true); 
    }else{
        setPath([]); 
        setIsComplete(false); 
    }
  },[matrix, energyBar, start, destination]);

  return (
    <div>
      <h2>Path:</h2>
      <pre>{JSON.stringify(path, null, 2)}</pre>
      {outOfEnergy && <p>Out of energy!</p>}
      {isComplete && <p>Path found!</p>}
    </div>
  );
};
ASTAR.propTypes = {
  matrix: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  energyBar: PropTypes.number.isRequired,
  start: PropTypes.arrayOf(PropTypes.number).isRequired,
  destination: PropTypes.arrayOf(PropTypes.number).isRequired,
};


export default ASTAR;