import { useEffect, useState } from "react";
import PropTypes from "prop-types";

const ASTAR = ({ matrix, energyBar, start, destination }) => {
  const size = matrix.length;
  const [path, setPath] = useState([]);
  const [outOfEnergy, setOutOfEnergy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  const isValidCell = (row, col) =>
    row >= 0 && row < size && col >= 0 && col < size && matrix[row][col] !== 1;

  const getCost = (cellValue) => {
    switch (cellValue) {
      case 0: return 0;
      case 2: return 1;
      case 3: return 2;
      case 4: return 3;
      default: return 0;
    }
  };

  const manhattanDistance = (r1, c1, r2, c2) =>
    Math.abs(r1 - r2) + Math.abs(c1 - c2);

  const findPath = (row, col, remainingEnergy, currentPath = [], visited = null, skullCount = 0) => {
    if (!visited) {
      visited = Array.from({ length: size }, () => Array(size).fill(false));
    }

    if (matrix[row][col] === 6) {
      return [...currentPath, [row, col]];
    }

    if (!isValidCell(row, col) || remainingEnergy < 0) {
      return null;
    }

    currentPath.push([row, col]);
    visited[row][col] = true;

    const cost = getCost(matrix[row][col]);
    const newEnergy = remainingEnergy - cost;

    if (newEnergy < 0) {
      setOutOfEnergy(true);
      return null;
    }

    if (matrix[row][col] === 4) {
      skullCount++;
    }

    if (skullCount >= 2) {
      setIsInvalid(true);
      return null;
    }

    let neighbors = [
      [row - 1, col],
      [row, col + 1],
      [row + 1, col],
      [row, col - 1],
    ];

    let validDirections = neighbors.filter(([r, c]) =>
      isValidCell(r, c) && !visited[r][c]
    );

    validDirections.sort((a, b) => {
      const hA = manhattanDistance(a[0], a[1], destination[0], destination[1]) + getCost(matrix[a[0]][a[1]]);
      const hB = manhattanDistance(b[0], b[1], destination[0], destination[1]) + getCost(matrix[b[0]][b[1]]);
      return hA - hB;
    });

    for (const [nextRow, nextCol] of validDirections) {
      const result = findPath(nextRow, nextCol, newEnergy, [...currentPath], visited, skullCount);
      if (result) {
        return result;
      }
    }

    currentPath.pop();
    return null;
  };

  useEffect(() => {
    const result = findPath(start[0], start[1], energyBar);
    if (result) {
      setPath(result);
      setIsComplete(matrix[result[result.length - 1][0]][result[result.length - 1][1]] === 6);
    } else {
      setPath([]);
      setIsComplete(false);
    }
  }, [matrix, energyBar, start, destination]);

  return (
    <div>
      <h2>Path:</h2>
      <p>{path.map(([r, c]) => `(${r},${c})`).join(" → ")}</p>
      {outOfEnergy && <p>⚡ Out of energy!</p>}
      {isComplete && <p>✅ Path found!</p>}
      {isInvalid && <p>❌ Invalid path (Hit two skulls in a row)</p>}
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
