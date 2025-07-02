export interface IndexItem {
  id: string;
  title: string;
  children?: IndexItem[];
  content?: string[] | null;
}
