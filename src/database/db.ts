import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// Database connection pool
let pool: mysql.Pool | null = null;
let dbEnabled = true;

export function isDatabaseEnabled(): boolean {
  return dbEnabled && !!process.env.DB_HOST;
}

export function getPool(): mysql.Pool {
  if (!process.env.DB_HOST) {
    console.warn('⚠️ Database not configured (DB_HOST missing). Database features disabled.');
    dbEnabled = false;
    throw new Error('Database not configured');
  }
  
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'diy_home_repair',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log('✅ Database pool created');
  }
  return pool;
}

// Types
export interface User {
  id: string;
  email: string | null;
  device_id: string | null;
  created_at: Date;
  last_active_at: Date;
}

export interface HomeProfileDB {
  id: string;
  user_id: string;
  nickname: string | null;
  home_type: string | null;
  year_built: string | null;
  pipe_type: string | null;
  water_heater_type: string | null;
  hvac_type: string | null;
  hvac_age: string | null;
  roof_type: string | null;
  roof_age: string | null;
  flooring_type: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AnalysisDB {
  id: string;
  user_id: string;
  description: string;
  had_photos: boolean;
  problem_short: string | null;
  confidence: number | null;
  confidence_level: string | null;
  diy_friendly: string | null;
  difficulty: string | null;
  estimated_time: string | null;
  estimated_cost: string | null;
  pro_estimate: string | null;
  summary: string | null;
  materials: any[] | null;
  tools: any[] | null;
  steps: string[] | null;
  warnings: string[] | null;
  call_a_pro_if: string[] | null;
  youtube_search_query: string | null;
  pro_type: string | null;
  created_at: Date;
}

// User functions
export async function createUser(email?: string, deviceId?: string): Promise<User> {
  const db = getPool();
  const id = uuidv4();
  
  await db.execute(
    'INSERT INTO users (id, email, device_id) VALUES (?, ?, ?)',
    [id, email || null, deviceId || null]
  );
  
  const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
  return (rows as User[])[0];
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
  const users = rows as User[];
  return users.length > 0 ? users[0] : null;
}

export async function findUserByDeviceId(deviceId: string): Promise<User | null> {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users WHERE device_id = ?', [deviceId]);
  const users = rows as User[];
  return users.length > 0 ? users[0] : null;
}

export async function findOrCreateUser(email?: string, deviceId?: string): Promise<User> {
  // Try to find by email first
  if (email) {
    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail) {
      // Update device_id if provided
      if (deviceId && existingByEmail.device_id !== deviceId) {
        await getPool().execute('UPDATE users SET device_id = ? WHERE id = ?', [deviceId, existingByEmail.id]);
      }
      // Update last_active_at
      await getPool().execute('UPDATE users SET last_active_at = NOW() WHERE id = ?', [existingByEmail.id]);
      return existingByEmail;
    }
  }
  
  // Try to find by device_id
  if (deviceId) {
    const existingByDevice = await findUserByDeviceId(deviceId);
    if (existingByDevice) {
      // Update email if provided and not set
      if (email && !existingByDevice.email) {
        await getPool().execute('UPDATE users SET email = ? WHERE id = ?', [email, existingByDevice.id]);
      }
      // Update last_active_at
      await getPool().execute('UPDATE users SET last_active_at = NOW() WHERE id = ?', [existingByDevice.id]);
      return existingByDevice;
    }
  }
  
  // Create new user
  return createUser(email, deviceId);
}

export async function updateUserEmail(userId: string, email: string): Promise<void> {
  const db = getPool();
  await db.execute('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
}

// Home Profile functions
export async function saveHomeProfile(userId: string, profile: Partial<HomeProfileDB>): Promise<HomeProfileDB> {
  const db = getPool();
  
  // Check if profile exists
  const [existing] = await db.execute('SELECT id FROM home_profiles WHERE user_id = ?', [userId]);
  const existingProfiles = existing as any[];
  
  if (existingProfiles.length > 0) {
    // Update existing
    await db.execute(`
      UPDATE home_profiles SET
        nickname = ?, home_type = ?, year_built = ?, pipe_type = ?,
        water_heater_type = ?, hvac_type = ?, hvac_age = ?,
        roof_type = ?, roof_age = ?, flooring_type = ?
      WHERE user_id = ?
    `, [
      profile.nickname || null,
      profile.home_type || null,
      profile.year_built || null,
      profile.pipe_type || null,
      profile.water_heater_type || null,
      profile.hvac_type || null,
      profile.hvac_age || null,
      profile.roof_type || null,
      profile.roof_age || null,
      profile.flooring_type || null,
      userId
    ]);
    
    const [rows] = await db.execute('SELECT * FROM home_profiles WHERE user_id = ?', [userId]);
    return (rows as HomeProfileDB[])[0];
  } else {
    // Create new
    const id = uuidv4();
    await db.execute(`
      INSERT INTO home_profiles (id, user_id, nickname, home_type, year_built, pipe_type,
        water_heater_type, hvac_type, hvac_age, roof_type, roof_age, flooring_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, userId,
      profile.nickname || null,
      profile.home_type || null,
      profile.year_built || null,
      profile.pipe_type || null,
      profile.water_heater_type || null,
      profile.hvac_type || null,
      profile.hvac_age || null,
      profile.roof_type || null,
      profile.roof_age || null,
      profile.flooring_type || null
    ]);
    
    const [rows] = await db.execute('SELECT * FROM home_profiles WHERE id = ?', [id]);
    return (rows as HomeProfileDB[])[0];
  }
}

// Analysis functions
export async function saveAnalysis(userId: string, analysis: Partial<AnalysisDB>): Promise<AnalysisDB> {
  const db = getPool();
  const id = uuidv4();
  
  await db.execute(`
    INSERT INTO analyses (
      id, user_id, description, had_photos, problem_short, confidence, confidence_level,
      diy_friendly, difficulty, estimated_time, estimated_cost, pro_estimate, summary,
      materials, tools, steps, warnings, call_a_pro_if, youtube_search_query, pro_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, userId,
    analysis.description,
    analysis.had_photos || false,
    analysis.problem_short || null,
    analysis.confidence || null,
    analysis.confidence_level || null,
    analysis.diy_friendly || null,
    analysis.difficulty || null,
    analysis.estimated_time || null,
    analysis.estimated_cost || null,
    analysis.pro_estimate || null,
    analysis.summary || null,
    analysis.materials ? JSON.stringify(analysis.materials) : null,
    analysis.tools ? JSON.stringify(analysis.tools) : null,
    analysis.steps ? JSON.stringify(analysis.steps) : null,
    analysis.warnings ? JSON.stringify(analysis.warnings) : null,
    analysis.call_a_pro_if ? JSON.stringify(analysis.call_a_pro_if) : null,
    analysis.youtube_search_query || null,
    analysis.pro_type || null
  ]);
  
  const [rows] = await db.execute('SELECT * FROM analyses WHERE id = ?', [id]);
  return (rows as AnalysisDB[])[0];
}

export async function getUserAnalyses(userId: string): Promise<AnalysisDB[]> {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows as AnalysisDB[];
}

// Analytics
export async function getAnalyticsSummary(): Promise<any> {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM analytics_summary');
  return (rows as any[])[0];
}

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const db = getPool();
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

