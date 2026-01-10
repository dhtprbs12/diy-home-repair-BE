-- DIY Home Repair Database Schema
-- MySQL 8.0+

-- Create database (run separately if needed)
-- CREATE DATABASE diy_home_repair;
-- USE diy_home_repair;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,  -- UUID
    email VARCHAR(255) NULL UNIQUE,
    device_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_device_id (device_id),
    INDEX idx_created_at (created_at)
);

-- Home profiles table
CREATE TABLE IF NOT EXISTS home_profiles (
    id VARCHAR(36) PRIMARY KEY,  -- UUID
    user_id VARCHAR(36) NOT NULL,
    nickname VARCHAR(100) NULL,
    home_type VARCHAR(50) NULL,
    year_built VARCHAR(50) NULL,
    pipe_type VARCHAR(50) NULL,
    water_heater_type VARCHAR(50) NULL,
    hvac_type VARCHAR(50) NULL,
    hvac_age VARCHAR(50) NULL,
    roof_type VARCHAR(50) NULL,
    roof_age VARCHAR(50) NULL,
    flooring_type VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Analyses (repair history) table
CREATE TABLE IF NOT EXISTS analyses (
    id VARCHAR(36) PRIMARY KEY,  -- UUID
    user_id VARCHAR(36) NOT NULL,
    
    -- User input
    description TEXT NOT NULL,
    had_photos BOOLEAN DEFAULT FALSE,
    
    -- AI analysis results
    problem_short VARCHAR(100) NULL,
    confidence DECIMAL(3,2) NULL,  -- 0.00 to 1.00
    confidence_level VARCHAR(20) NULL,  -- high, medium, low
    diy_friendly VARCHAR(20) NULL,  -- yes, maybe, no
    difficulty VARCHAR(20) NULL,  -- easy, medium, hard
    estimated_time VARCHAR(50) NULL,
    estimated_cost VARCHAR(50) NULL,
    pro_estimate VARCHAR(50) NULL,
    summary TEXT NULL,
    
    -- JSON fields for complex data
    materials JSON NULL,
    tools JSON NULL,
    steps JSON NULL,
    warnings JSON NULL,
    call_a_pro_if JSON NULL,
    
    -- Metadata
    youtube_search_query VARCHAR(255) NULL,
    pro_type VARCHAR(100) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_diy_friendly (diy_friendly)
);

-- Analytics view (optional, for quick stats)
CREATE OR REPLACE VIEW analytics_summary AS
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.email IS NOT NULL THEN u.id END) as users_with_email,
    COUNT(a.id) as total_analyses,
    COUNT(DISTINCT CASE WHEN a.had_photos = TRUE THEN a.id END) as analyses_with_photos,
    AVG(a.confidence) as avg_confidence,
    COUNT(DISTINCT CASE WHEN a.diy_friendly = 'yes' THEN a.id END) as diy_friendly_count,
    COUNT(DISTINCT CASE WHEN a.diy_friendly = 'no' THEN a.id END) as needs_pro_count
FROM users u
LEFT JOIN analyses a ON u.id = a.user_id;

