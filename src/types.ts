export interface PixelData {
  color: string;
}

export type Grid = PixelData[][];

export interface Tool {
  id: string;
  name: string;
  icon: string;
}

export const DEFAULT_COLORS = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", 
  "#ffff00", "#ff00ff", "#00ffff", "#808080", "#c0c0c0",
  "#800000", "#808000", "#008000", "#800080", "#008080", "#000080",
  "#ffa500", "#a52a2a", "#8b4513", "#d2691e", "#f4a460", "#deb887"
];
