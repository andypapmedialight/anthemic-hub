<?php
declare(strict_types=1);

$gigsPath     = __DIR__ . '/../gigs.json';
$contentPath  = __DIR__ . '/../../content/hub.json';
$passwordHash = getenv('GIGS_ADMIN_PASSWORD_HASH') ?: '';
$adminBase    = '/gigs/admin/';

session_start();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['logout'])) {
    session_destroy();
    header('Location: ' . $adminBase);
    exit;
}

$loginError = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($passwordHash && password_verify($_POST['password'], $passwordHash)) {
        session_regenerate_id(true);
        $_SESSION['authed'] = true;
        $_SESSION['csrf']   = bin2hex(random_bytes(16));
        header('Location: ' . $adminBase);
        exit;
    }
    $loginError = 'Incorrect password.';
}

if (empty($_SESSION['authed'])) { showLogin($loginError); exit; }

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

function csrfCheck(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf'] ?? '')) {
        http_response_code(403); die('CSRF check failed.');
    }
}

function loadGigs(string $path): array {
    if (!is_file($path)) return [];
    $data = json_decode((string)file_get_contents($path), true);
    return is_array($data['gigs'] ?? null) ? $data['gigs'] : [];
}

function saveGigs(string $path, array $gigs): void {
    $out = json_encode(
        ['gigs' => array_values($gigs)],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    $tmp = $path . '.tmp.' . getmypid();
    file_put_contents($tmp, $out . "\n");
    rename($tmp, $path);
}

function loadContent(string $path): array {
    if (!is_file($path)) return [];
    $data = json_decode((string)file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

function saveContent(string $path, array $data): void {
    $out = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $tmp = $path . '.tmp.' . getmypid();
    file_put_contents($tmp, $out . "\n");
    rename($tmp, $path);
}

function sanitizeGig(array $p): array {
    $url = trim($p['link'] ?? '');
    if ($url && !preg_match('#^https?://#i', $url)) $url = '';
    return [
        'date'    => preg_replace('/[^0-9\-]/', '', substr($p['date']    ?? '', 0, 10)),
        'title'   => substr(trim(strip_tags($p['title']   ?? '')), 0, 200),
        'venue'   => substr(trim(strip_tags($p['venue']   ?? '')), 0, 200),
        'city'    => substr(trim(strip_tags($p['city']    ?? '')), 0, 100),
        'time'    => substr(trim(strip_tags($p['time']    ?? '')), 0, 50),
        'role'    => substr(trim(strip_tags($p['role']    ?? '')), 0, 100),
        'support' => substr(trim(strip_tags($p['support'] ?? '')), 0, 200),
        'link'    => substr($url, 0, 500),
    ];
}

function h(mixed $v): string {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function selfUrl(): string { global $adminBase; return $adminBase; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrfCheck();
    $action = $_POST['action'] ?? '';
    $gigs   = loadGigs($gigsPath);
    if ($action === 'add') {
        $gig = sanitizeGig($_POST);
        if ($gig['date'] !== '' && $gig['title'] !== '') {
            $gigs[] = $gig;
            saveGigs($gigsPath, $gigs);
        }
    } elseif ($action === 'edit') {
        $idx = (int)($_POST['idx'] ?? -1);
        if ($idx >= 0 && isset($gigs[$idx])) {
            $gig = sanitizeGig($_POST);
            if ($gig['date'] !== '' && $gig['title'] !== '') {
                $gigs[$idx] = $gig;
                saveGigs($gigsPath, $gigs);
            }
        }
    } elseif ($action === 'delete') {
        $idx = (int)($_POST['idx'] ?? -1);
        if ($idx >= 0 && isset($gigs[$idx])) {
            array_splice($gigs, $idx, 1);
            saveGigs($gigsPath, $gigs);
        }
    } elseif ($action === 'raw') {
        $raw = $_POST['raw_json'] ?? '';
        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($decoded['gigs']) && is_array($decoded['gigs'])) {
            saveGigs($gigsPath, $decoded['gigs']);
        } else {
            $_SESSION['raw_error'] = 'Invalid JSON or missing "gigs" array. Changes not saved.';
        }
    } elseif ($action === 'content_save') {
        global $contentPath;
        $content = loadContent($contentPath);
        $content['who_am_i']          = trim(strip_tags($_POST['who_am_i'] ?? ''));
        $content['music_bio_origin']  = array_values(array_filter(array_map('trim', explode("\n\n", str_replace("\r\n", "\n", $_POST['music_bio_origin'] ?? '')))));
        $content['music_bio_anthems'] = array_values(array_filter(array_map('trim', explode("\n\n", str_replace("\r\n", "\n", $_POST['music_bio_anthems'] ?? '')))));

        // Instruments: one per line, * prefix = primary
        $instLines = array_filter(array_map('trim', explode("\n", str_replace("\r\n", "\n", $_POST['instruments'] ?? ''))));
        $content['instruments'] = array_values(array_map(function (string $line): array {
            $primary = str_starts_with($line, '*');
            return ['name' => trim(ltrim($line, '* ')), 'primary' => $primary];
        }, $instLines));

        // Projects: one per line, format "Name | dates" (dates optional)
        $projLines = array_filter(array_map('trim', explode("\n", str_replace("\r\n", "\n", $_POST['projects'] ?? ''))));
        $content['projects'] = array_values(array_map(function (string $line): array {
            $parts = explode('|', $line, 2);
            return ['name' => trim($parts[0]), 'dates' => isset($parts[1]) ? trim($parts[1]) : ''];
        }, $projLines));

        saveContent($contentPath, $content);
        $_SESSION['content_saved'] = true;
    }
    header('Location: ' . selfUrl()); exit;
}

$gigs         = loadGigs($gigsPath);
$editIdx      = (isset($_GET['edit']) && ctype_digit((string)$_GET['edit'])) ? (int)$_GET['edit'] : -1;
$editGig      = ($editIdx >= 0 && isset($gigs[$editIdx])) ? $gigs[$editIdx] : null;
$csrf         = $_SESSION['csrf'];
$rawError     = $_SESSION['raw_error'] ?? null;
$contentSaved = $_SESSION['content_saved'] ?? false;
unset($_SESSION['raw_error'], $_SESSION['content_saved']);

$content      = loadContent($contentPath);
$activeTab    = isset($_GET['tab']) && $_GET['tab'] === 'content' ? 'content' : 'gigs';

// Helpers for content form display
function contentInstText(array $c): string {
    $insts = $c['instruments'] ?? [];
    return implode("\n", array_map(fn($i) => ($i['primary'] ? '*' : '') . $i['name'], $insts));
}
function contentProjText(array $c): string {
    $projs = $c['projects'] ?? [];
    return implode("\n", array_map(fn($p) => $p['name'] . ($p['dates'] ? ' | ' . $p['dates'] : ''), $projs));
}
function contentParasText(array $c, string $key): string {
    $paras = $c[$key] ?? [];
    return is_array($paras) ? implode("\n\n", $paras) : (string)$paras;
}

function showLogin(?string $error): void { ?>
<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Gig Admin — Login</title>
  <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />
  <style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100vh;background:#0e1015;color:#eceef4;font-family:'Figtree',system-ui,sans-serif;display:flex;align-items:center;justify-content:center}
    .box{width:100%;max-width:360px;padding:36px 32px;background:#161b24;border:1px solid #2a3140;border-radius:12px}
    h1{margin:0 0 24px;font-size:1.25rem;font-weight:600;letter-spacing:-0.02em}
    label{display:block;font-size:13px;font-weight:600;color:#949db0;margin-bottom:6px}
    input[type=password]{width:100%;padding:10px 12px;background:#0e1015;border:1px solid #2a3140;border-radius:6px;color:#eceef4;font-family:inherit;font-size:1rem}
    input[type=password]:focus{outline:none;border-color:#6b9cff}
    button{margin-top:16px;width:100%;padding:11px;background:#6b9cff;border:none;border-radius:6px;color:#0e1015;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}
    button:hover{background:#8db0ff}
    .err{margin-top:14px;padding:10px 12px;background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.3);border-radius:6px;color:#ff9999;font-size:13px}
  </style>
</head>
<body>
  <div class="box">
    <h1>Gig Calendar Admin</h1>
    <form method="post">
      <label for="pw">Password</label>
      <input type="password" id="pw" name="password" autofocus required />
      <button type="submit">Sign in</button>
    </form>
    <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif ?>
  </div>
</body>
</html>
<?php }

function gigForm(string $action, array $g = [], int $idx = -1, string $csrf = ''): void {
    $isEdit = $action === 'edit'; ?>
<form method="post" class="gig-form">
  <input type="hidden" name="action" value="<?= h($action) ?>" />
  <input type="hidden" name="csrf"   value="<?= h($csrf) ?>" />
  <?php if ($isEdit): ?><input type="hidden" name="idx" value="<?= $idx ?>" /><?php endif ?>
  <div class="form-grid">
    <div class="field">
      <label>Date <span class="req">*</span></label>
      <input type="date" name="date" value="<?= h($g['date'] ?? '') ?>" required />
    </div>
    <div class="field">
      <label>Time</label>
      <input type="text" name="time" value="<?= h($g['time'] ?? '') ?>" placeholder="8pm–11pm" />
    </div>
    <div class="field span2">
      <label>Title <span class="req">*</span></label>
      <input type="text" name="title" value="<?= h($g['title'] ?? '') ?>" required placeholder="Show / artist name" />
    </div>
    <div class="field">
      <label>Venue</label>
      <input type="text" name="venue" value="<?= h($g['venue'] ?? '') ?>" placeholder="Melbourne Town Hall" />
    </div>
    <div class="field">
      <label>City</label>
      <input type="text" name="city" value="<?= h($g['city'] ?? '') ?>" placeholder="Melbourne" />
    </div>
    <div class="field">
      <label>Role</label>
      <input type="text" name="role" value="<?= h($g['role'] ?? '') ?>" placeholder="Bass" />
    </div>
    <div class="field">
      <label>Support</label>
      <input type="text" name="support" value="<?= h($g['support'] ?? '') ?>" placeholder="Opening act" />
    </div>
    <div class="field span2">
      <label>Link</label>
      <input type="url" name="link" value="<?= h($g['link'] ?? '') ?>" placeholder="https://..." />
    </div>
  </div>
  <div class="form-actions">
    <button type="submit" class="btn-primary"><?= $isEdit ? 'Save changes' : 'Add gig' ?></button>
    <?php if ($isEdit): ?>
      <a href="<?= h($GLOBALS['adminBase']) ?>?tab=gigs" class="btn-cancel">Cancel</a>
    <?php endif ?>
  </div>
</form>
<?php } ?>
<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Gig Admin — Anthemic</title>
  <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />
  <style>
    *{box-sizing:border-box}html,body{margin:0;background:#0e1015;color:#eceef4;font-family:'Figtree',system-ui,sans-serif;font-size:16px;line-height:1.5;min-height:100vh}
    .wrap{max-width:760px;margin:0 auto;padding:32px 24px 64px}
    .top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid #2a3140}
    h1{margin:0;font-size:1.3rem;font-weight:600;letter-spacing:-0.02em}
    .btn-logout{font-family:inherit;font-size:13px;font-weight:600;padding:7px 14px;background:transparent;border:1px solid #2a3140;border-radius:6px;color:#949db0;cursor:pointer}
    .btn-logout:hover{border-color:#3d4659;color:#eceef4}
    h2{font-size:13px;font-weight:600;letter-spacing:.04em;color:#949db0;text-transform:uppercase;margin:0 0 14px}
    .gig-list{display:flex;flex-direction:column;gap:8px;margin-bottom:40px}
    .gig-row{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#161b24;border:1px solid #2a3140;border-radius:8px}
    .gig-row.editing{border-color:#6b9cff}
    .gig-info{flex:1;min-width:0}
    .gig-title-text{font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gig-meta-text{font-size:12px;color:#949db0;margin-top:2px}
    .row-actions{display:flex;gap:8px;flex-shrink:0}
    .btn-edit,.btn-del{font-family:inherit;font-size:12px;font-weight:600;padding:5px 12px;border-radius:5px;cursor:pointer;border:1px solid}
    .btn-edit{background:transparent;border-color:#2a3140;color:#949db0}
    .btn-edit:hover{border-color:#6b9cff;color:#6b9cff}
    .btn-del{background:transparent;border-color:transparent;color:#666}
    .btn-del:hover{border-color:rgba(255,80,80,.3);color:#ff9999}
    .panel{background:#161b24;border:1px solid #2a3140;border-radius:10px;padding:24px}
    .panel h2{margin-bottom:20px}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .field{display:flex;flex-direction:column;gap:6px}
    .field.span2{grid-column:span 2}
    label{font-size:13px;font-weight:600;color:#949db0}
    .req{color:#c9a227}
    input[type=text],input[type=date],input[type=url]{padding:9px 11px;background:#0e1015;border:1px solid #2a3140;border-radius:6px;color:#eceef4;font-family:inherit;font-size:.9rem;width:100%}
    input:focus{outline:none;border-color:#6b9cff}
    .form-actions{display:flex;align-items:center;gap:12px;margin-top:20px}
    .btn-primary{font-family:inherit;font-size:14px;font-weight:600;padding:10px 20px;background:#6b9cff;border:none;border-radius:6px;color:#0e1015;cursor:pointer}
    .btn-primary:hover{background:#8db0ff}
    .btn-cancel{font-size:13px;font-weight:600;color:#949db0;text-decoration:none}
    .btn-cancel:hover{color:#eceef4}
    .empty{color:#949db0;font-size:.9rem;padding:16px 0}
    textarea.raw-json{width:100%;min-height:280px;padding:12px;background:#0e1015;border:1px solid #2a3140;border-radius:6px;color:#eceef4;font-family:'SF Mono',ui-monospace,monospace;font-size:.82rem;line-height:1.6;resize:vertical}
    textarea.raw-json:focus{outline:none;border-color:#6b9cff}
    textarea.content-area{width:100%;padding:10px 12px;background:#0e1015;border:1px solid #2a3140;border-radius:6px;color:#eceef4;font-family:inherit;font-size:.9rem;line-height:1.65;resize:vertical}
    textarea.content-area:focus{outline:none;border-color:#6b9cff}
    .raw-error{padding:10px 14px;background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.3);border-radius:6px;color:#ff9999;font-size:13px;margin-bottom:16px}
    .save-notice{padding:10px 14px;background:rgba(107,156,255,.1);border:1px solid rgba(107,156,255,.3);border-radius:6px;color:#b8d4ff;font-size:13px;margin-bottom:16px}
    details>summary{cursor:pointer;font-size:13px;font-weight:600;color:#949db0;letter-spacing:.04em;text-transform:uppercase;padding:20px 0 0;user-select:none}
    details>summary:hover{color:#eceef4}
    details[open]>summary{padding-bottom:16px}
    .tab-nav{display:flex;gap:0;margin-bottom:28px;border-bottom:1px solid #2a3140}
    .tab-btn{font-family:inherit;font-size:13px;font-weight:600;padding:10px 20px;background:transparent;border:none;border-bottom:2px solid transparent;color:#949db0;cursor:pointer;margin-bottom:-1px}
    .tab-btn:hover{color:#eceef4}
    .tab-btn.active{color:#6b9cff;border-bottom-color:#6b9cff}
    .content-field{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}
    .content-field label{font-size:13px;font-weight:600;color:#949db0}
    .content-field .hint{font-size:11px;color:#5a6377;margin-top:2px}
    @media(max-width:540px){.form-grid{grid-template-columns:1fr}.field.span2{grid-column:span 1}}
  </style>
</head>
<body>
<div class="wrap">
  <div class="top-bar">
    <h1>Anthemic Admin</h1>
    <form method="post">
      <input type="hidden" name="logout" value="1" />
      <button type="submit" class="btn-logout">Sign out</button>
    </form>
  </div>

  <nav class="tab-nav">
    <a href="<?= h($adminBase) ?>?tab=gigs"    class="tab-btn<?= $activeTab === 'gigs'    ? ' active' : '' ?>">Gig calendar</a>
    <a href="<?= h($adminBase) ?>?tab=content" class="tab-btn<?= $activeTab === 'content' ? ' active' : '' ?>">Site content</a>
  </nav>

  <?php if ($activeTab === 'content'): ?>

  <?php if ($contentSaved): ?><p class="save-notice">Content saved.</p><?php endif ?>

  <div class="panel">
    <h2>Who am I</h2>
    <form method="post">
      <input type="hidden" name="action" value="content_save" />
      <input type="hidden" name="csrf"   value="<?= h($csrf) ?>" />
      <div class="content-field">
        <label>Bio text</label>
        <textarea name="who_am_i" class="content-area" rows="4"><?= h($content['who_am_i'] ?? '') ?></textarea>
      </div>
      <div class="content-field">
        <label>Music bio — How it all began</label>
        <span class="hint">Separate paragraphs with a blank line.</span>
        <textarea name="music_bio_origin" class="content-area" rows="10"><?= h(contentParasText($content, 'music_bio_origin')) ?></textarea>
      </div>
      <div class="content-field">
        <label>Music bio — Why 'Anthems to the Fall'?</label>
        <span class="hint">Separate paragraphs with a blank line.</span>
        <textarea name="music_bio_anthems" class="content-area" rows="6"><?= h(contentParasText($content, 'music_bio_anthems')) ?></textarea>
      </div>
      <div class="content-field">
        <label>Instruments</label>
        <span class="hint">One per line. Prefix with <code>*</code> for a primary instrument (blue chip). E.g. <code>*Double bass</code></span>
        <textarea name="instruments" class="content-area" rows="8"><?= h(contentInstText($content)) ?></textarea>
      </div>
      <div class="content-field">
        <label>Projects &amp; artists</label>
        <span class="hint">One per line. Optionally add dates after a pipe: <code>Dollop | 1993–96</code></span>
        <textarea name="projects" class="content-area" rows="14"><?= h(contentProjText($content)) ?></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Save content</button>
      </div>
    </form>
  </div>

  <?php else: ?>

  <h2>All gigs</h2>
  <div class="gig-list">
    <?php if (empty($gigs)): ?>
      <p class="empty">No gigs yet.</p>
    <?php else: foreach ($gigs as $i => $g): ?>
      <div class="gig-row<?= $i === $editIdx ? ' editing' : '' ?>">
        <div class="gig-info">
          <div class="gig-title-text"><?= h($g['title']) ?></div>
          <div class="gig-meta-text"><?= h($g['date']) ?><?= $g['venue'] ? ' · ' . h($g['venue']) : '' ?><?= $g['city'] ? ', ' . h($g['city']) : '' ?></div>
        </div>
        <div class="row-actions">
          <a href="<?= h($adminBase) ?>?tab=gigs&edit=<?= $i ?>" class="btn-edit">Edit</a>
          <form method="post" onsubmit="return confirm('Delete this gig?')">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="idx"    value="<?= $i ?>" />
            <input type="hidden" name="csrf"   value="<?= h($csrf) ?>" />
            <button type="submit" class="btn-del">Delete</button>
          </form>
        </div>
      </div>
    <?php endforeach; endif ?>
  </div>

  <?php if ($editGig !== null): ?>
    <div class="panel">
      <h2>Edit gig</h2>
      <?php gigForm('edit', $editGig, $editIdx, $csrf) ?>
    </div>
  <?php else: ?>
    <div class="panel">
      <h2>Add gig</h2>
      <?php gigForm('add', [], -1, $csrf) ?>
    </div>
  <?php endif ?>

  <div class="panel" style="margin-top:24px">
    <details>
      <summary>Raw JSON editor</summary>
      <?php if ($rawError): ?>
        <p class="raw-error"><?= h($rawError) ?></p>
      <?php endif ?>
      <form method="post" onsubmit="return confirm('Overwrite gigs.json with this JSON?')">
        <input type="hidden" name="action" value="raw" />
        <input type="hidden" name="csrf"   value="<?= h($csrf) ?>" />
        <textarea name="raw_json" class="raw-json" spellcheck="false"><?= h(json_encode(['gigs' => $gigs], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) ?></textarea>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save raw JSON</button>
        </div>
      </form>
    </details>
  </div>

  <?php endif ?>
</div>
</body>
</html>