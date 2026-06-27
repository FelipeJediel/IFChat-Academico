-- IFchan — Schema MySQL
-- Execute: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS ifchan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ifchan;

-- -----------------------------------------------
-- Usuários
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    handle     VARCHAR(55)  NOT NULL UNIQUE,
    email      VARCHAR(120) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,          -- password_hash()
    avatar     VARCHAR(2)   NOT NULL DEFAULT '',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Canais (categorias)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
    id    VARCHAR(30) PRIMARY KEY,
    label VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO channels (id, label) VALUES
    ('geral',      'Geral'),
    ('computacao', 'Computação'),
    ('biologia',   'Biologia'),
    ('memes',      'Memes'),
    ('jogos',      'Jogos'),
    ('skate',      'Skate');

-- -----------------------------------------------
-- Threads
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS threads (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    author_id  INT UNSIGNED NOT NULL,
    channel_id VARCHAR(30)  NOT NULL,
    title      VARCHAR(200) NOT NULL,
    body       TEXT         NOT NULL,
    image_path VARCHAR(300) DEFAULT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id)  REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    INDEX idx_channel  (channel_id),
    INDEX idx_author   (author_id),
    INDEX idx_created  (created_at DESC)
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Respostas
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS replies (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    thread_id  INT UNSIGNED NOT NULL,
    author_id  INT UNSIGNED NOT NULL,
    text       TEXT         NOT NULL,
    image_path VARCHAR(300) DEFAULT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)   ON DELETE CASCADE,
    INDEX idx_thread  (thread_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Notificações
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    target_user_id  INT UNSIGNED NOT NULL,
    type            ENUM('reply','like','thread','system') NOT NULL DEFAULT 'system',
    message         VARCHAR(255) NOT NULL,
    link_thread_id  INT UNSIGNED DEFAULT NULL,
    is_read         TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_target (target_user_id, is_read)
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Curtidas (futuro)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
    user_id   INT UNSIGNED NOT NULL,
    thread_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, thread_id),
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
) ENGINE=InnoDB;
