
import { DbService } from './db';

/**
 * In a real-world scenario, this service would use the Google Sheets API.
 * For this demo, we simulate the sync behavior.
 */
export class GoogleSheetsService {
  static async syncToSheets(): Promise<boolean> {
    console.log("Simulating sync to Google Sheets...");
    // 1. Fetch all local data
    // 2. Format as spreadsheet rows
    // 3. Update Google Sheets via API
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  }

  static async syncFromSheets(userId: string): Promise<number> {
    console.log("Simulating sync from Google Sheets...");
    // 1. Fetch spreadsheet rows
    // 2. Detect changes (newer timestamp or missing IDs)
    // 3. Update local database
    await new Promise(resolve => setTimeout(resolve, 1500));
    return Math.floor(Math.random() * 3); // Return number of changes found
  }

  static async connectSheet(sheetUrl: string): Promise<string | null> {
    // Extract ID from URL
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const id = match[1];
    
    const config = DbService.getConfig();
    DbService.saveConfig({ ...config, googleSheetsId: id });
    return id;
  }
}
