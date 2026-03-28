/** Opening team info / filters from cards and schedule rows. */
export interface TeamSelectPayload {
  teamName: string;
  collegeName?: string;
  zoneId?: string | null;
  zoneName?: string | null;
}
