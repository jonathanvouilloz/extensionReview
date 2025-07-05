-- Table des projets
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    max_comments INTEGER DEFAULT 100,
    notify_email BOOLEAN DEFAULT 0,
    webhook_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired'))
);

-- Table des commentaires
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    project_code TEXT NOT NULL,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    screenshot_url TEXT,
    coordinates_x INTEGER,
    coordinates_y INTEGER,
    coordinates_width INTEGER,
    coordinates_height INTEGER,
    user_agent TEXT,
    screen_resolution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
    FOREIGN KEY (project_code) REFERENCES projects(code)
);

-- Index pour performance
CREATE INDEX idx_comments_project_code ON comments(project_code);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_owner ON projects(owner_email); 