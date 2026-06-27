<?php
/**
 * IFchan — Notifications API
 * GET  /php/notifications.php             → lista notificações do usuário logado
 * POST /php/notifications.php?action=read → marca todas como lidas
 */
require_once __DIR__ . '/config.php';
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Toda rota aqui exige login
$auth = requireAuth();

if ($method === 'GET') {
    $db   = getDB();
    $stmt = $db->prepare('
        SELECT id, type, message, link_thread_id, is_read, created_at
        FROM notifications
        WHERE target_user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ');
    $stmt->execute([$auth['id']]);
    $notifs = $stmt->fetchAll();

    $unread = count(array_filter($notifs, fn($n) => !$n['is_read']));
    jsonResponse(['notifications' => $notifs, 'unread' => $unread]);
}

if ($method === 'POST' && $action === 'read') {
    $db   = getDB();
    $stmt = $db->prepare('UPDATE notifications SET is_read = 1 WHERE target_user_id = ?');
    $stmt->execute([$auth['id']]);
    jsonResponse(['message' => 'Notificações marcadas como lidas.']);
}

jsonResponse(['error' => 'Método não suportado.'], 405);
