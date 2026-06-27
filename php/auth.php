<?php
/**
 * IFchan — Auth API
 * POST /php/auth.php?action=login
 * POST /php/auth.php?action=register
 * POST /php/auth.php?action=logout
 * GET  /php/auth.php?action=me
 * POST /php/auth.php?action=update
 */
require_once __DIR__ . '/config.php';

// session_start() UMA VEZ só, aqui no topo
session_start();

$action = $_GET['action'] ?? '';

switch ($action) {

    // ---------------------------------------------------------
    case 'register':
        $data     = getRequestBody();
        $username = trim($data['username'] ?? '');
        $email    = trim($data['email']    ?? '');
        $password =      $data['password'] ?? '';

        if (!$username || !$email || !$password) {
            jsonResponse(['error' => 'Preencha todos os campos.'], 400);
        }
        if (strlen($password) < 4) {
            jsonResponse(['error' => 'Senha deve ter ao menos 4 caracteres.'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'E-mail inválido.'], 400);
        }

        $db = getDB();

        $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
        $stmt->execute([$username, $email]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Usuário ou e-mail já em uso.'], 409);
        }

        $handle = '@' . strtolower(preg_replace('/\s+/', '', $username));
        $hash   = password_hash($password, PASSWORD_BCRYPT);
        $avatar = mb_strtoupper(mb_substr($username, 0, 1));

        $stmt = $db->prepare(
            'INSERT INTO users (username, handle, email, password, avatar) VALUES (?,?,?,?,?)'
        );
        $stmt->execute([$username, $handle, $email, $hash, $avatar]);
        $userId = (int)$db->lastInsertId();

        $_SESSION['user_id']  = $userId;
        $_SESSION['username'] = $username;

        jsonResponse([
            'id'       => $userId,
            'username' => $username,
            'handle'   => $handle,
            'email'    => $email,
            'avatar'   => $avatar,
        ], 201);
        break;

    // ---------------------------------------------------------
    case 'login':
        $data     = getRequestBody();
        $login    = trim($data['username'] ?? '');
        $password =      $data['password'] ?? '';

        if (!$login || !$password) {
            jsonResponse(['error' => 'Preencha todos os campos.'], 400);
        }

        $db   = getDB();
        $stmt = $db->prepare(
            'SELECT id, username, handle, email, password, avatar
             FROM users WHERE username = ? OR email = ?'
        );
        $stmt->execute([$login, $login]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(['error' => 'Usuário ou senha incorretos.'], 401);
        }

        $_SESSION['user_id']  = $user['id'];
        $_SESSION['username'] = $user['username'];

        unset($user['password']);
        jsonResponse($user);
        break;

    // ---------------------------------------------------------
    case 'logout':
        session_destroy();
        jsonResponse(['message' => 'Sessão encerrada.']);
        break;

    // ---------------------------------------------------------
    case 'me':
        if (empty($_SESSION['user_id'])) {
            jsonResponse(['error' => 'Não autenticado.'], 401);
        }
        $db   = getDB();
        $stmt = $db->prepare(
            'SELECT id, username, handle, email, avatar FROM users WHERE id = ?'
        );
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if (!$user) jsonResponse(['error' => 'Usuário não encontrado.'], 404);
        jsonResponse($user);
        break;

    // ---------------------------------------------------------
    case 'update':
        $auth     = requireAuth();
        $data     = getRequestBody();
        $username = trim($data['username'] ?? '');
        $handle   = trim($data['handle']   ?? '');
        $email    = trim($data['email']    ?? '');

        if (!$username) {
            jsonResponse(['error' => 'Nome de usuário obrigatório.'], 400);
        }

        $db     = getDB();
        $avatar = mb_strtoupper(mb_substr($username, 0, 1));
        $stmt   = $db->prepare(
            'UPDATE users SET username=?, handle=?, email=?, avatar=? WHERE id=?'
        );
        $stmt->execute([$username, $handle, $email, $avatar, $auth['id']]);

        $_SESSION['username'] = $username;
        jsonResponse([
            'message'  => 'Perfil atualizado.',
            'username' => $username,
            'handle'   => $handle,
            'email'    => $email,
            'avatar'   => $avatar,
        ]);
        break;

    // ---------------------------------------------------------
    default:
        jsonResponse(['error' => 'Ação inválida.'], 400);
}
