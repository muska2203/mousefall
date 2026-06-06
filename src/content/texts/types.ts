export interface ContentText {
  name: string;
  description?: string;
  flavorText?: string;
}

export interface ContentTexts {
  items: Record<string, ContentText>;
  entities: Record<string, ContentText>;
  abilities: Record<string, ContentText>;
  players: Record<string, ContentText>;
  stairs: Record<string, ContentText>;
}
