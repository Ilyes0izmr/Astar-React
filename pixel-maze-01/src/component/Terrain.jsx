
import { useState, useEffect } from "react";
import "./Terrain.css";
import ASTAR from "./ASTAR";


const Terrain = () => {
    const size = 15;
    const [grid, setGrid] = useState(Array(size).fill().map(() => Array(size).fill({ id: 0, neighbor: 0 })));
    useEffect(() => {
        const generateGrid = () => {
            let newMatrix = Array.from({ length: size }, () =>
                Array.from({ length: size }, () => ({ id: 0, neighbor: 0 }))
            );

            const staticPattern = [
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 0, 1, 0, 0, 4, 0, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1],
                [0, 0, 0, 0, 1, 0, 0, 1, 4, 1, 0, 1, 0, 0, 1],
                [0, 0, 0, 0, 2, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1],
                [1, 0, 0, 3, 5, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                [1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1],
                [1, 0, 1, 1, 0, 3, 0, 1, 0, 1, 1, 0, 1, 0, 1],
                [1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                [1, 0, 0, 1, 4, 1, 1, 2, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 2, 4, 6, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 1, 0, 0, 2, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            ];

            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    newMatrix[row][col].id = staticPattern[row][col];
                }
            }
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const currentId = newMatrix[row][col].id;
            
                    
                    const southNeighbor = row < size - 1 ? newMatrix[row + 1][col].id : 9;
                    const northNeighbor = row > 0 ? newMatrix[row - 1][col].id : 9;
                    const westNeighbor = col > 0 ? newMatrix[row][col - 1].id : 9; 
                    const eastNeighbor = col < size - 1 ? newMatrix[row][col + 1].id : 9; 
                    const southWestNeighbor = row < size - 1 && col > 0 ? newMatrix[row + 1][col - 1].id : 9;
                    const southEastNeighbor = row < size - 1 && col < size - 1 ? newMatrix[row + 1][col + 1].id : 9;
                    const northWestNeighbor = row > 0 && col > 0 ? newMatrix[row - 1][col - 1].id : 9;
                    const northEastNeighbor = row > 0 && col < size - 1 ? newMatrix[row - 1][col + 1].id : 9;
            
                    /* 2all logic: currentId === 1 */
                    if (currentId === 1) {

                        if(eastNeighbor !== 1 && westNeighbor !== 1 && southNeighbor !== 1 && northNeighbor === 1 ){
                            newMatrix[row][col].neighbor = 21;
                            continue;
                        }
                        if(eastNeighbor === 1 && westNeighbor === 1 && southNeighbor === 1 && 
                            southWestNeighbor === 1 &&  southEastNeighbor !== 1){
                            newMatrix[row][col].neighbor = 17;
                            continue;
                        }
                        if(eastNeighbor !== 1  && southNeighbor === 9 ){
                            newMatrix[row][col].neighbor = 20;
                            continue;
                        }
                        if(
                            eastNeighbor === 1 && westNeighbor !== 1 && southNeighbor !== 1 && northNeighbor === 1 && 
                            southWestNeighbor !== 9 
                        ){
                            newMatrix[row][col].neighbor = 13; 
                            continue;
                        }
                        if(eastNeighbor !== 1  && southNeighbor !== 1){
                            newMatrix[row][col].neighbor = 15;
                            continue;
                        }
                        if(eastNeighbor === 1 && westNeighbor !== 1 && southNeighbor === 1 && northNeighbor !== 1 &&
                            southWestNeighbor !== 1 && northEastNeighbor !== 1 && northWestNeighbor !== 1 && southEastNeighbor === 1){
                            newMatrix[row][col].neighbor = 9;
                            continue;
                        }
                        if((eastNeighbor !== 1 && westNeighbor === 1 && southNeighbor === 1  &&
                            southWestNeighbor !== 1 )){
                            newMatrix[row][col].neighbor = 14;
                            continue;
                        }
                        
                        if(
                            eastNeighbor !== 1 && westNeighbor === 1 && southNeighbor !== 1 && northNeighbor === 1 && 
                            southWestNeighbor !== 1 && northEastNeighbor === 1 && northWestNeighbor === 1 && southEastNeighbor !== 1 
                        ){
                             newMatrix[row][col].neighbor = 12; 
                             continue;
                        }
                        if(eastNeighbor === 1 && westNeighbor === 1 && southNeighbor === 1 && northNeighbor === 1 && 
                            southWestNeighbor === 1 && northEastNeighbor !== 1 && northWestNeighbor !== 1 && southEastNeighbor !== 1 
                        ){
                             newMatrix[row][col].neighbor = 11; 
                             continue;
                        }
                        if(eastNeighbor === 1 && westNeighbor === 1 && southNeighbor === 1 && northNeighbor === 1 && 
                            southWestNeighbor === 1 && northEastNeighbor === 1 && northWestNeighbor === 1 && southEastNeighbor === 1 
                        ){
                             newMatrix[row][col].neighbor = 10; 
                             continue;
                         }
                        if(northNeighbor === 1 && southNeighbor === 1 &&  westNeighbor !== 1 && westNeighbor !== 9 && eastNeighbor === 1 && southEastNeighbor !== 1){
                            newMatrix[row][col].neighbor = 8; 
                            continue;
                        }
                        if (eastNeighbor === 9 && westNeighbor === 1 && southWestNeighbor !== 1 && southNeighbor === 1 ) { 
                            newMatrix[row][col].neighbor = 4 ; //conrner number one  
                            continue;
                        }
                        
                        if (eastNeighbor === 1 && westNeighbor === 9 && southEastNeighbor !== 1 && southNeighbor === 1) { 
                            newMatrix[row][col].neighbor = 2 ; //conrner number one  
                            continue;
                        }
                        if (eastNeighbor === 1 && westNeighbor !== 1 && southEastNeighbor !== 1 && southNeighbor === 1) { 
                            newMatrix[row][col].neighbor = 22 ; //conrner number one  
                            continue;
                        }
                        if(northNeighbor === 1 && southNeighbor === 1 && westNeighbor !== 9 && westNeighbor !== 1 && eastNeighbor === 1){
                            newMatrix[row][col].neighbor = 9; 
                            continue;
                        }
                        if(southNeighbor === 1 && westNeighbor !== 9 && westNeighbor !== 1){
                            newMatrix[row][col].neighbor = 3; 
                            continue;
                        }
                        if(southNeighbor === 9){
                            newMatrix[row][col].neighbor = 19; 
                            continue;
                        }
                        if (southNeighbor !== 1) {
                            newMatrix[row][col].neighbor = 1; 
                            continue;
                        }
                        if(northNeighbor !==1 && eastNeighbor === 1 && westNeighbor === 1 && southNeighbor === 1 && southEastNeighbor === 1 && southWestNeighbor === 1){
                            newMatrix[row][col].neighbor = 5; 
                            continue;
                        }
                        if(eastNeighbor !== 1 && northNeighbor === 1 && southNeighbor === 1 && westNeighbor !== 1){
                            newMatrix[row][col].neighbor = 6; 
                            continue;
                        }
                        if(eastNeighbor === 1 && westNeighbor === 1 && southNeighbor === 1 && southEastNeighbor !== 1 && southWestNeighbor !== 1){
                            newMatrix[row][col].neighbor = 7; 
                            continue;
                        }
                        if(eastNeighbor === 1 && westNeighbor === 1 && southNeighbor === 1 && southWestNeighbor !== 1){
                            newMatrix[row][col].neighbor = 18; 
                            continue;
                        }
                        if(eastNeighbor !== 1){
                            newMatrix[row][col].neighbor = 16; 
                            continue;
                        }
                        
                        
                    }        
                    if (currentId === 0 && northNeighbor === 1) {
                        newMatrix[row][col].neighbor = 9;
                        continue;
                    }
            
                    
                    newMatrix[row][col].neighbor = 0; 
                }
            }
            setGrid(newMatrix);
        };

        generateGrid();
    }, []);
    
    const matrix = grid.map(row => row.map(cell => cell.id));

    return (
        <div>
            <h2>Terrain</h2>
            {grid.length > 0 && (
                <>
                    <ASTAR 
                        matrix={matrix}  
                        grid={grid}  
                        energyBar={11} 
                        start={[5, 4]} 
                        destination={[10, 5]} 
                    />
                </>
            )}
        </div>
    );
    
};

export default Terrain;
