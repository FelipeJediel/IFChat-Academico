<?php
/**
 * IFchan — Threads API
 * GET    /php/threads.php              → lista threads (query: channel, page)
 * GET    /php/threads.php?id=X         → thread + replies
 * POST   /php/threads.php              → criar thread (auth)
 * POST   /php/threads.php?action=reply&id=X → responder (auth)
 * DELETE /php/threads.php?id=X         → deletar thread (auth)
 */
require_once __DIR__ . '/config.php';

// session_start() UMA VEZ só, no topo, antes de qualquer coisa
session_start();

$method   = $_SERVER['REQUEST_METHOD'];
$action   = $_GET['action'] ?? '';
$threadId = (int)($_GET['id'] ?? 0);

// -------------------------------------------------------
// GET /threads.php → lista paginada
// -------------------------------------------------------
if ($method === 'GET' && !$threadId) {
    $channel = $_GET['channel'] ?? '';
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;
    $offset  = ($page - 1) * $perPage;

    $db  = getDB();
    $sql = '
        SELECT t.id, t.title, t.body, t.image_path, t.created_at,
               t.channel_id AS channel,
               u.username   AS author_name,
               u.avatar     AS author_avatar,
               (SELECT COUNT(*) FROM replies r WHERE r.thread_id = t.id) AS reply_count
        FROM threads t
        JOIN users u ON u.id = t.author_id
    ';
    $params = [];

    if ($channel && $channel !== 'todos') {
        $sql     .= ' WHERE t.channel_id = ?';
        $params[] = $channel;
    }
    $sql     .= ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    $params[] = $perPage;
    $params[] = $offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $threads = $stmt->fetchAll();

    $countSql    = 'SELECT COUNT(*) FROM threads t';
    $countParams = [];
    if ($channel && $channel !== 'todos') {
        $countSql    .= ' WHERE t.channel_id = ?';
        $countParams[] = $channel;
    }
    $countStmt = $db->prepare($countSql);
    $countStmt->execute($countParams);
    $total = (int)$countStmt->fetchColumn();

    jsonResponse([
        'threads'  => $threads,
        'total'    => $total,
        'page'     => $page,
        'per_page' => $perPage,
        'pages'    => (int)ceil($total / $perPage),
    ]);
}

// -------------------------------------------------------
// GET /threads.php?id=X → thread específica + replies
// -------------------------------------------------------
if ($method === 'GET' && $threadId) {
    $db = getDB();

    $stmt = $db->prepare('
        SELECT t.id, t.title, t.body, t.image_path, t.created_at,
               t.channel_id AS channel,
               u.username   AS author_name,
               u.avatar     AS author_avatar
        FROM threads t
        JOIN users u ON u.id = t.author_id
        WHERE t.id = ?
    ');
    $stmt->execute([$threadId]);
    $thread = $stmt->fetch();

    if (!$thread) {
        jsonResponse(['error' => 'Thread não encontrada.'], 404);
    }

    $stmt = $db->prepare('
        SELECT r.id, r.text, r.image_path, r.created_at,
               u.username AS author_name, u.avatar AS author_avatar
        FROM replies r
        JOIN users u ON u.id = r.author_id
        WHERE r.thread_id = ?
        ORDER BY r.created_at ASC
    ');
    $stmt->execute([$threadId]);
    $thread['replies'] = $stmt->fetchAll();

    jsonResponse($thread);
}

// -------------------------------------------------------
// POST /threads.php → criar thread (requer login)
// -------------------------------------------------------
if ($method === 'POST' && !$action) {
    $auth = requireAuth();
    $data = getRequestBody();

    $title   = trim($data['title']   ?? '');
    $body    = trim($data['body']    ?? '');
    $channel = trim($data['channel'] ?? 'geral');

    if (!$title) {
        jsonResponse(['error' => 'Título obrigatório.'], 400);
    }

    $imagePath = null;
    if (!empty($data['image'])) {
        $imagePath = saveBase64Image($data['image'], 'threads');
    }

    $db   = getDB();
    $stmt = $db->prepare(
        'INSERT INTO threads (author_id, channel_id, title, body, image_path) VALUES (?,?,?,?,?)'
    );
    $stmt->execute([$auth['id'], $channel, $title, $body, $imagePath]);
    $id = (int)$db->lastInsertId();

    jsonResponse(['id' => $id, 'message' => 'Thread criada.'], 201);
}

// -------------------------------------------------------
// POST /threads.php?action=reply&id=X → responder (requer login)
// -------------------------------------------------------
if ($method === 'POST' && $action === 'reply' && $threadId) {
    $auth = requireAuth();
    $data = getRequestBody();
    $text = trim($data['text'] ?? '');

    if (!$text && empty($data['image'])) {
        jsonResponse(['error' => 'Resposta vazia.'], 400);
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, author_id, title FROM threads WHERE id = ?');
    $stmt->execute([$threadId]);
    $thread = $stmt->fetch();
    if (!$thread) jsonResponse(['error' => 'Thread não encontrada.'], 404);

    $imagePath = null;
    if (!empty($data['image'])) {
        $imagePath = saveBase64Image($data['image'], 'replies');
    }

    $stmt = $db->prepare(
        'INSERT INTO replies (thread_id, author_id, text, image_path) VALUES (?,?,?,?)'
    );
    $stmt->execute([$threadId, $auth['id'], $text ?: '', $imagePath]);
    $replyId = (int)$db->lastInsertId();

    // Notificar autor da thread se for outra pessoa
    if ((int)$thread['author_id'] !== (int)$auth['id']) {
        $msg  = $auth['username'] . ' respondeu na sua thread "' . mb_substr($thread['title'], 0, 60) . '"';
        $stmt = $db->prepare(
            'INSERT INTO notifications (target_user_id, type, message, link_thread_id) VALUES (?,?,?,?)'
        );
        $stmt->execute([$thread['author_id'], 'reply', $msg, $threadId]);
    }

    jsonResponse(['id' => $replyId, 'message' => 'Resposta adicionada.'], 201);
}

// -------------------------------------------------------
// DELETE /threads.php?id=X → deletar thread (requer login)
// -------------------------------------------------------
if ($method === 'DELETE' && $threadId) {
    $auth = requireAuth();
    $db   = getDB();

    $stmt = $db->prepare('SELECT author_id FROM threads WHERE id = ?');
    $stmt->execute([$threadId]);
    $thread = $stmt->fetch();

    if (!$thread) jsonResponse(['error' => 'Thread não encontrada.'], 404);
    if ((int)$thread['author_id'] !== (int)$auth['id']) {
        jsonResponse(['error' => 'Sem permissão.'], 403);
    }

    $db->prepare('DELETE FROM threads WHERE id = ?')->execute([$threadId]);
    jsonResponse(['message' => 'Thread deletada.']);
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function saveBase64Image(string $base64, string $folder): ?string {
    $matches = [];
    if (!preg_match('/^data:(image\/\w+);base64,(.+)$/', $base64, $matches)) {
        return null;
    }

    $ext     = str_replace('image/', '', $matches[1]);
    $allowed = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed, true)) return null;

    $uploadDir = __DIR__ . '/../assets/uploads/' . $folder . '/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0775, true);

    $filename = uniqid() . '.' . $ext;
    $decoded  = base64_decode($matches[2]);

    if (strlen($decoded) > 5 * 1024 * 1024) return null;

    file_put_contents($uploadDir . $filename, $decoded);
    return 'assets/uploads/' . $folder . '/' . $filename;
}
