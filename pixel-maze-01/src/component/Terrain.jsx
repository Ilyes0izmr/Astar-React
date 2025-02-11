import { useState, useEffect } from "react";
import "./Terrain.css";
import TerrainLayers from "./TerrainLayers";

const Terrain = () => {
    const size = 15; 
    const [grid, setGrid] = useState([]);

    useEffect(() => {
        const generateGrid = () => {
            let newMatrix = Array.from({ length: size }, () =>
                Array.from({ length: size }, () => ({
                    id: 0,
                    neighbor: 0, 
                }))
            );

            /*for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const value = Math.floor(Math.random() * 3) + 1; // random 1, 2, or 3 for the block id
                    newMatrix[i][j].id = value;
                
                }
            }*/
                

            const staticPattern = [
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
                [0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1],
                [1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1],
                [1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1],
                [1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                [1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
                [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
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

    return (
        <div>
            <h2>Terrain</h2>
            <TerrainLayers grid={grid} />
        </div>
    );
};

export default Terrain;