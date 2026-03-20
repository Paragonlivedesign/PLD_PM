/* ============================================
   Module: Profile Editor
   Depends on: modal.js, theme.js
   ============================================ */
function openProfileEditor() {
  document.querySelector('.modal').style.maxWidth = '780px';
  openModal('My Profile', renderProfileBody(), renderProfileFooter());
}

function renderProfileBody() {
  const tabs = [
    { id: 'personal', label: 'Personal Info', iconKey: 'profilePersonal' },
    { id: 'security', label: 'Security', iconKey: 'profileSecurity' },
    { id: 'notifications', label: 'Notifications', iconKey: 'profileNotifications' },
    { id: 'activity', label: 'Activity Log', iconKey: 'profileActivity' },
  ];
  return `
    <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
      ${tabs.map(t => `<button class="btn ${profileTab === t.id ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="profileTab='${t.id}';document.getElementById('modalBody').innerHTML=renderProfileBody();initProfileTabListeners();">${uiIcon(t.iconKey) ? uiIcon(t.iconKey)+' ' : ''}${t.label}</button>`).join('')}
    </div>
    <div id="profileTabContent">
      ${profileTab === 'personal' ? renderProfilePersonal() : profileTab === 'security' ? renderProfileSecurity() : profileTab === 'notifications' ? renderProfileNotifications() : renderProfileActivity()}
    </div>
  `;
}

function renderProfileFooter() {
  if (profileTab === 'activity') return '<button class="btn btn-secondary" onclick="resetModalWidth();closeModal();">Close</button>';
  return '<button class="btn btn-secondary" onclick="resetModalWidth();closeModal();">Cancel</button><button class="btn btn-primary" onclick="showToast(\'Profile updated!\',\'success\');resetModalWidth();closeModal();">Save Changes</button>';
}

function resetModalWidth() {
  document.querySelector('.modal').style.maxWidth = '600px';
}

function renderProfilePersonal() {
  return `
    <div style="display:flex;gap:24px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-subtle);">
      <div style="flex-shrink:0;text-align:center;">
        <div style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,var(--accent-blue),var(--accent-cyan));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:32px;color:#fff;margin-bottom:10px;">CM</div>
        <button class="btn btn-secondary btn-sm" onclick="openAvatarUploadModal()" style="width:100%;">Change Photo</button>
        <button class="btn btn-ghost btn-sm" onclick="showConfirm('Remove Avatar','Remove your profile photo?',()=>showToast('Avatar removed','warning'))" style="width:100%;margin-top:4px;font-size:11px;color:var(--accent-red);">Remove</button>
      </div>
      <div style="flex:1;">
        <div style="font-size:20px;font-weight:700;margin-bottom:2px;">Cody Martin</div>
        <div style="font-size:13px;color:var(--text-tertiary);margin-bottom:8px;">Production Manager · ACME Productions</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <span style="font-size:11px;padding:3px 10px;background:var(--accent-blue);color:#fff;border-radius:12px;">Tenant Admin</span>
          <span style="font-size:11px;padding:3px 10px;background:var(--bg-tertiary);color:var(--text-secondary);border-radius:12px;">Active since Jan 2024</span>
          <span style="font-size:11px;padding:3px 10px;background:var(--bg-tertiary);color:var(--text-secondary);border-radius:12px;">Last login: Today</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">First Name</label><input type="text" class="form-input" value="Cody"></div>
      <div class="form-group"><label class="form-label">Last Name</label><input type="text" class="form-input" value="Martin"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Email Address</label><input type="email" class="form-input" value="cody@acmeproductions.com"><div style="font-size:11px;color:var(--accent-green);margin-top:4px;">✓ Verified</div></div>
      <div class="form-group"><label class="form-label">Phone Number</label><input type="tel" class="form-input" value="(555) 987-6543"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Job Title</label><input type="text" class="form-input" value="Production Manager"></div>
      <div class="form-group"><label class="form-label">Department</label><select class="form-select"><option selected>Management</option><option>Audio</option><option>Video</option><option>Lighting</option><option>Camera</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Timezone</label><select class="form-select"><option selected>America/New_York (EST)</option><option>America/Chicago (CST)</option><option>America/Denver (MST)</option><option>America/Los_Angeles (PST)</option><option>America/Anchorage (AKST)</option><option>Pacific/Honolulu (HST)</option><option>Europe/London (GMT)</option></select></div>
      <div class="form-group"><label class="form-label">Language</label><select class="form-select"><option selected>English (US)</option><option>English (UK)</option><option>EspaÃ±ol</option><option>FranÃ§ais</option><option>Deutsch</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Date Format</label><select class="form-select"><option selected>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></div>
      <div class="form-group"><label class="form-label">Time Format</label><select class="form-select"><option selected>12-hour (3:00 PM)</option><option>24-hour (15:00)</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Bio / Notes</label><textarea class="form-textarea" style="min-height:60px;" placeholder="Tell your crew a bit about yourself…">15+ years in live production. Specializing in large-scale broadcast events including Super Bowl, NBA, UFC, and concert tours.</textarea></div>
    <div class="form-group"><label class="form-label">Emergency Contact</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <input type="text" class="form-input" value="Jane Martin" placeholder="Name">
        <input type="text" class="form-input" value="Spouse" placeholder="Relationship">
        <input type="tel" class="form-input" value="(555) 123-0000" placeholder="Phone">
      </div>
    </div>
  `;
}

function renderProfileSecurity() {
  return `
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Change Password</div>
      <div class="form-group"><label class="form-label">Current Password</label><input type="password" class="form-input" placeholder="Enter current password"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group"><label class="form-label">New Password</label><input type="password" class="form-input" id="newPwField" placeholder="Min 8 characters" oninput="updatePwStrength(this.value)"></div>
        <div class="form-group"><label class="form-label">Confirm New Password</label><input type="password" class="form-input" placeholder="Repeat new password"></div>
      </div>
      <div id="pwStrengthBar" style="margin-top:-8px;margin-bottom:16px;">
        <div style="display:flex;gap:4px;margin-bottom:4px;">
          <div style="flex:1;height:4px;background:var(--border-default);"></div>
          <div style="flex:1;height:4px;background:var(--border-default);"></div>
          <div style="flex:1;height:4px;background:var(--border-default);"></div>
          <div style="flex:1;height:4px;background:var(--border-default);"></div>
        </div>
        <div style="font-size:11px;color:var(--text-tertiary);">Enter a new password to see strength</div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border-subtle);padding-top:20px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Two-Factor Authentication</div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--bg-tertiary);margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:24px;">📱</div>
          <div>
            <div style="font-weight:500;font-size:13px;">Authenticator App</div>
            <div style="font-size:12px;color:var(--text-tertiary);">Use Google Authenticator, Authy, or similar</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;padding:3px 10px;background:rgba(34,197,94,0.15);color:var(--accent-green);border-radius:12px;">Enabled</span>
          <button class="btn btn-ghost btn-sm" onclick="resetModalWidth();closeModal();setTimeout(open2FAConfigureModal,150)">Configure</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--bg-tertiary);margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:24px;">📷</div>
          <div>
            <div style="font-weight:500;font-size:13px;">Email Backup Codes</div>
            <div style="font-size:12px;color:var(--text-tertiary);">Receive one-time codes via email</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;padding:3px 10px;background:var(--bg-tertiary);color:var(--text-tertiary);border:1px solid var(--border-default);border-radius:12px;">Not set up</span>
          <button class="btn btn-secondary btn-sm" onclick="resetModalWidth();closeModal();setTimeout(openEmailCodesModal,150)">Set Up</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--bg-tertiary);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:24px;">🔑</div>
          <div>
            <div style="font-weight:500;font-size:13px;">Recovery Codes</div>
            <div style="font-size:12px;color:var(--text-tertiary);">One-time use codes for account recovery</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showConfirm('Regenerate Codes','This will invalidate your existing codes. Continue?',()=>showToast('New recovery codes generated','success'))">Regenerate</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border-subtle);padding-top:20px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Active Sessions</div>
      ${[
        { device:'Windows PC — Chrome', location:'New York, NY', time:'Current session', current:true },
        { device:'iPhone 15 — Safari', location:'New York, NY', time:'2 hours ago', current:false },
        { device:'MacBook Pro — Chrome', location:'Los Angeles, CA', time:'3 days ago', current:false },
      ].map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:18px;">${s.device.includes('iPhone')?'📱':s.device.includes('Mac')?'🏠':'📱'}</div>
            <div>
              <div style="font-size:13px;font-weight:500;">${s.device}${s.current?' <span style="color:var(--accent-green);font-size:11px;font-weight:400;">• Active now</span>':''}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">${s.location} · ${s.time}</div>
            </div>
          </div>
          ${s.current ? '' : '<button class="btn btn-ghost btn-sm" style="color:var(--accent-red);" onclick="showConfirm(\'Revoke Session\',\'End this session?\',()=>showToast(\'Session revoked\',\'warning\'))">Revoke</button>'}
        </div>
      `).join('')}
    </div>
  `;
}

function initProfileTabListeners() {
  document.getElementById('modalFooter').innerHTML = renderProfileFooter();
}

function updatePwStrength(val) {
  const bar = document.getElementById('pwStrengthBar');
  if (!bar) return;
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors = ['var(--accent-red)','var(--accent-amber)','var(--accent-amber)','var(--accent-green)'];
  const labels = ['Weak','Fair','Good','Strong'];
  if (val.length === 0) {
    bar.innerHTML = '<div style="display:flex;gap:4px;margin-bottom:4px;"><div style="flex:1;height:4px;background:var(--border-default);"></div><div style="flex:1;height:4px;background:var(--border-default);"></div><div style="flex:1;height:4px;background:var(--border-default);"></div><div style="flex:1;height:4px;background:var(--border-default);"></div></div><div style="font-size:11px;color:var(--text-tertiary);">Enter a new password to see strength</div>';
  } else {
    const c = colors[score-1] || colors[0];
    bar.innerHTML = '<div style="display:flex;gap:4px;margin-bottom:4px;">' + [1,2,3,4].map(i => '<div style="flex:1;height:4px;background:' + (i<=score?c:'var(--border-default)') + ';transition:background 200ms;"></div>').join('') + '</div><div style="font-size:11px;color:' + c + ';">' + (labels[score-1]||'Weak') + '</div>';
  }
}

function renderProfileNotifications() {
  const prefs = [
    { cat:'Scheduling', items:[
      { label:'Assignment created for me', desc:'When I get assigned to an event', email:true, push:true, slack:true },
      { label:'Scheduling conflicts', desc:'When a double-booking involves me', email:true, push:true, slack:false },
      { label:'Assignment changes', desc:'When my assignment is modified or cancelled', email:true, push:true, slack:false },
    ]},
    { cat:'Events', items:[
      { label:'Phase changes', desc:'When an event I am assigned to changes phase', email:true, push:false, slack:true },
      { label:'New events', desc:'When a new event is created', email:false, push:false, slack:true },
      { label:'Event reminders', desc:'24hr and 1hr before my call time', email:true, push:true, slack:false },
    ]},
    { cat:'Travel', items:[
      { label:'Booking confirmations', desc:'When flights or hotels are booked for me', email:true, push:true, slack:false },
      { label:'Itinerary changes', desc:'When my travel plans are modified', email:true, push:true, slack:false },
    ]},
    { cat:'Documents', items:[
      { label:'Documents shared with me', desc:'When someone shares a doc or crew pack', email:true, push:false, slack:true },
      { label:'Document updates', desc:'When a document I authored is regenerated', email:false, push:false, slack:false },
    ]},
    { cat:'System', items:[
      { label:'Security alerts', desc:'New login from unrecognized device', email:true, push:true, slack:false },
      { label:'Weekly digest', desc:'Summary of activity across all events', email:true, push:false, slack:false },
    ]},
  ];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-tertiary);">Choose how you want to be notified for each category.</div>
      <button class="btn btn-ghost btn-sm" onclick="showToast('All notifications enabled','success')">Enable All</button>
    </div>
    ${prefs.map(cat => `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">${cat.cat}</div>
        ${cat.items.map(item => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;">${item.label}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">${item.desc}</div>
            </div>
            <div style="display:flex;gap:16px;align-items:center;flex-shrink:0;margin-left:16px;">
              <div style="text-align:center;"><div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px;">Email</div><div class="toggle ${item.email?'active':''}" onclick="this.classList.toggle('active')" style="width:32px;height:18px;"></div></div>
              <div style="text-align:center;"><div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px;">Push</div><div class="toggle ${item.push?'active':''}" onclick="this.classList.toggle('active')" style="width:32px;height:18px;"></div></div>
              <div style="text-align:center;"><div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px;">Slack</div><div class="toggle ${item.slack?'active':''}" onclick="this.classList.toggle('active')" style="width:32px;height:18px;"></div></div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;
}

// ============================================
// Company / Organization Profile
// ============================================
let companyTab = 'info';

function openCompanyProfile() {
  document.querySelector('.modal').style.maxWidth = '780px';
  openModal('Company Profile', renderCompanyBody(), renderCompanyFooter());
}

function renderCompanyBody() {
  const tabs = [
    { id: 'info', label: 'Company Info' },
    { id: 'branding', label: 'Branding' },
    { id: 'team', label: 'Team' },
    { id: 'billing', label: 'Billing' },
  ];
  return `
    <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
      ${tabs.map(t => `<button class="btn ${companyTab === t.id ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="companyTab='${t.id}';document.getElementById('modalBody').innerHTML=renderCompanyBody();">${t.label}</button>`).join('')}
    </div>
    <div id="companyTabContent">
      ${companyTab === 'info' ? renderCompanyInfo() : companyTab === 'branding' ? renderCompanyBranding() : companyTab === 'team' ? renderCompanyTeam() : renderCompanyBilling()}
    </div>
  `;
}

function renderCompanyFooter() {
  return `<button class="btn btn-secondary" onclick="resetModalWidth();closeModal();">Cancel</button>
          <button class="btn btn-primary" onclick="showToast('Company profile updated!','success');resetModalWidth();closeModal();">Save Changes</button>`;
}

function renderCompanyInfo() {
  return `
    <div style="display:flex;gap:24px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-subtle);">
      <div style="flex-shrink:0;text-align:center;">
        <div style="width:80px;height:80px;border-radius:12px;background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;color:#fff;margin-bottom:10px;">AC</div>
        <button class="btn btn-secondary btn-sm" onclick="resetModalWidth();closeModal();setTimeout(()=>openCompanyLogoUploadModal(),150);" style="width:100%;font-size:11px;">Change Logo</button>
      </div>
      <div style="flex:1;">
        <div style="font-size:20px;font-weight:700;margin-bottom:2px;">Acme Productions</div>
        <div style="font-size:13px;color:var(--text-tertiary);margin-bottom:8px;">Live event production company</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <span style="font-size:11px;padding:3px 10px;background:var(--accent-green);color:#fff;border-radius:12px;">Active</span>
          <span style="font-size:11px;padding:3px 10px;background:var(--bg-tertiary);color:var(--text-secondary);border-radius:12px;">Pro Plan</span>
          <span style="font-size:11px;padding:3px 10px;background:var(--bg-tertiary);color:var(--text-secondary);border-radius:12px;">Since Jan 2022</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Company Name</label><input type="text" class="form-input" value="Acme Productions"></div>
      <div class="form-group"><label class="form-label">Legal Name</label><input type="text" class="form-input" value="Acme Productions LLC"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Industry</label><select class="form-select"><option selected>Live Event Production</option><option>Broadcast Production</option><option>Film Production</option><option>Corporate Events</option><option>Concert Touring</option></select></div>
      <div class="form-group"><label class="form-label">Company Size</label><select class="form-select"><option>1-10</option><option selected>11-50</option><option>51-200</option><option>201-500</option><option>500+</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-input" value="450 W 33rd St, Suite 800"></div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">City</label><input type="text" class="form-input" value="New York"></div>
      <div class="form-group"><label class="form-label">State</label><input type="text" class="form-input" value="NY"></div>
      <div class="form-group"><label class="form-label">ZIP</label><input type="text" class="form-input" value="10001"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-input" value="(212) 555-0100"></div>
      <div class="form-group"><label class="form-label">Website</label><input type="url" class="form-input" value="https://acmeproductions.com"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="form-group"><label class="form-label">EIN / Tax ID</label><input type="text" class="form-input" value="XX-XXXXXXX" placeholder="XX-XXXXXXX"></div>
      <div class="form-group"><label class="form-label">Primary Contact Email</label><input type="email" class="form-input" value="info@acmeproductions.com"></div>
    </div>
    <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" style="min-height:60px;">Full-service live event production company specializing in broadcast sports, concerts, corporate events, and award shows. Operating nationwide with crews in NYC, LA, Chicago, and Atlanta.</textarea></div>
  `;
}

function renderCompanyBranding() {
  return `
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Company Logo</div>
      <div style="display:flex;gap:24px;align-items:center;padding:20px;background:var(--bg-tertiary);border:1px dashed var(--border-default);margin-bottom:16px;">
        <div style="width:80px;height:80px;border-radius:12px;background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;color:#fff;">AC</div>
        <div>
          <div style="font-size:13px;font-weight:500;margin-bottom:4px;">Current Logo</div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px;">Recommended: 256x256px, PNG or SVG</div>
          <button class="btn btn-secondary btn-sm" onclick="resetModalWidth();closeModal();setTimeout(()=>openCompanyLogoUploadModal(),150);">Upload New Logo</button>
        </div>
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Brand Colors</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Primary Color</label>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="color" value="#3b82f6" style="width:36px;height:36px;border:none;border-radius:4px;cursor:pointer;">
            <input type="text" class="form-input" value="#3b82f6" style="flex:1;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Secondary Color</label>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="color" value="#8b5cf6" style="width:36px;height:36px;border:none;border-radius:4px;cursor:pointer;">
            <input type="text" class="form-input" value="#8b5cf6" style="flex:1;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Accent Color</label>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="color" value="#22c55e" style="width:36px;height:36px;border:none;border-radius:4px;cursor:pointer;">
            <input type="text" class="form-input" value="#22c55e" style="flex:1;">
          </div>
        </div>
      </div>
    </div>

    <div>
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Document Branding</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-tertiary);cursor:pointer;">
          <input type="checkbox" checked>
          <div><div style="font-size:13px;font-weight:500;">Include logo on generated documents</div><div style="font-size:11px;color:var(--text-tertiary);">Crew packs, day sheets, and call sheets will show company logo</div></div>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-tertiary);cursor:pointer;">
          <input type="checkbox" checked>
          <div><div style="font-size:13px;font-weight:500;">Include company name in headers</div><div style="font-size:11px;color:var(--text-tertiary);">All exported PDFs will have company name in the header</div></div>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-tertiary);cursor:pointer;">
          <input type="checkbox">
          <div><div style="font-size:13px;font-weight:500;">Custom footer text</div><div style="font-size:11px;color:var(--text-tertiary);">Add legal or contact info to document footers</div></div>
        </label>
      </div>
    </div>
  `;
}

function renderCompanyTeam() {
  const team = [
    { name: 'Cody Martin', role: 'Production Manager', email: 'cody@acmeproductions.com', access: 'Admin', status: 'online', initials: 'CM', color: '#3b82f6' },
    { name: 'Alex Johnson', role: 'Production Manager', email: 'alex@acmeproductions.com', access: 'Admin', status: 'online', initials: 'AJ', color: '#ec4899' },
    { name: 'Jake Wilson', role: 'Technical Director', email: 'jake@acmeproductions.com', access: 'Manager', status: 'online', initials: 'JW', color: '#22c55e' },
    { name: 'Sarah Lee', role: 'A2 - Audio Tech', email: 'sarah@acmeproductions.com', access: 'Crew', status: 'offline', initials: 'SL', color: '#8b5cf6' },
    { name: 'Mike Thompson', role: 'A1 - Audio Engineer', email: 'mike@acmeproductions.com', access: 'Crew', status: 'offline', initials: 'MT', color: '#3b82f6' },
    { name: 'Emma Davis', role: 'Shader - Video', email: 'emma@acmeproductions.com', access: 'Crew', status: 'away', initials: 'ED', color: '#f59e0b' },
  ];
  const accessColors = { Admin: 'var(--accent-red)', Manager: 'var(--accent-blue)', Crew: 'var(--text-tertiary)' };
  const statusDots = { online: 'var(--accent-green)', away: 'var(--accent-amber)', offline: 'var(--border-default)' };

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--text-tertiary);">${team.length} team members</div>
      <button class="btn btn-primary btn-sm" onclick="resetModalWidth();closeModal();setTimeout(()=>openCompanyInviteMemberModal(),150);">+ Invite Member</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Member</th><th>Role</th><th>Access</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${team.map(m => `
            <tr>
              <td><div style="display:flex;align-items:center;gap:10px;">
                <div style="position:relative;">
                  <div style="width:32px;height:32px;border-radius:50%;background:${m.color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;">${m.initials}</div>
                  <div style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:50%;background:${statusDots[m.status]};border:2px solid var(--bg-secondary);"></div>
                </div>
                <div>
                  <div style="font-weight:500;font-size:13px;">${m.name}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);">${m.email}</div>
                </div>
              </div></td>
              <td style="font-size:12px;">${m.role}</td>
              <td><span style="font-size:11px;font-weight:600;color:${accessColors[m.access]};">${m.access}</span></td>
              <td><span style="font-size:11px;color:var(--text-tertiary);text-transform:capitalize;">${m.status}</span></td>
              <td><button class="btn btn-ghost btn-sm" onclick="resetModalWidth();closeModal();setTimeout(()=>openCompanyEditMemberModal('${m.name}','${m.role}','${m.email}','${m.access}'),150);">Edit</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:16px;padding:12px;background:var(--bg-tertiary);font-size:12px;color:var(--text-tertiary);">
      <strong>Access Levels:</strong> Admin (full access + settings), Manager (manage events, crew, scheduling), Crew (view assignments, update own profile)
    </div>
  `;
}

function renderCompanyBilling() {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
      <div class="stat-card" style="padding:16px;">
        <div class="stat-label">Current Plan</div>
        <div style="font-size:20px;font-weight:700;color:var(--accent-blue);">Pro</div>
        <div style="font-size:11px;color:var(--text-tertiary);">$199/month</div>
      </div>
      <div class="stat-card" style="padding:16px;">
        <div class="stat-label">Billing Cycle</div>
        <div style="font-size:20px;font-weight:700;">Monthly</div>
        <div style="font-size:11px;color:var(--text-tertiary);">Next: Mar 1, 2026</div>
      </div>
      <div class="stat-card" style="padding:16px;">
        <div class="stat-label">Users</div>
        <div style="font-size:20px;font-weight:700;">6 / 25</div>
        <div style="font-size:11px;color:var(--text-tertiary);">seats used</div>
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Payment Method</div>
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--bg-tertiary);border:1px solid var(--border-default);">
        <div style="font-size:24px;">💳</div>
        <div style="flex:1;">
          <div style="font-weight:500;font-size:13px;">Visa ending in 4242</div>
          <div style="font-size:11px;color:var(--text-tertiary);">Expires 08/2028</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="resetModalWidth();closeModal();setTimeout(()=>openUpdatePaymentModal(),150);">Update</button>
      </div>
    </div>

    <div>
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Recent Invoices</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Feb 1, 2026</td><td>Pro Plan - Monthly</td><td>$199.00</td><td><span style="color:var(--accent-green);font-size:12px;font-weight:500;">Paid</span></td></tr>
            <tr><td>Jan 1, 2026</td><td>Pro Plan - Monthly</td><td>$199.00</td><td><span style="color:var(--accent-green);font-size:12px;font-weight:500;">Paid</span></td></tr>
            <tr><td>Dec 1, 2025</td><td>Pro Plan - Monthly</td><td>$199.00</td><td><span style="color:var(--accent-green);font-size:12px;font-weight:500;">Paid</span></td></tr>
            <tr><td>Nov 1, 2025</td><td>Pro Plan - Monthly + 2 seats</td><td>$249.00</td><td><span style="color:var(--accent-green);font-size:12px;font-weight:500;">Paid</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;">
      <button class="btn btn-secondary btn-sm" onclick="resetModalWidth();closeModal();setTimeout(()=>openUpgradePlanModal(),150);">Upgrade Plan</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--accent-red);" onclick="showConfirm('Cancel Subscription','Are you sure you want to cancel? Your account will remain active until the end of the billing period.',()=>showToast('Subscription cancelled','warning'))">Cancel Subscription</button>
    </div>
  `;
}

function renderProfileActivity() {
  const logs = [
    { action:'Logged in', detail:'Chrome on Windows · New York, NY', time:'Just now', iconKey:'activityLoggedIn', color:'var(--accent-blue)' },
    { action:'Updated event', detail:'Super Bowl LXI Pre-Show — changed phase to "Live"', time:'15 min ago', iconKey:'activityUpdatedEvent', color:'var(--accent-purple)' },
    { action:'Assigned crew', detail:'Added Sarah Lee to Super Bowl LXI as A2', time:'1 hr ago', iconKey:'activityAssignedCrew', color:'var(--accent-cyan)' },
    { action:'Generated document', detail:'Crew Pack v3 for Super Bowl LXI', time:'2 hrs ago', iconKey:'activityGeneratedDoc', color:'var(--accent-green)' },
    { action:'Approved travel', detail:'DL1247 JFK→LAS for Mike Thompson ($420)', time:'3 hrs ago', iconKey:'activityApprovedTravel', color:'var(--accent-blue)' },
    { action:'Resolved conflict', detail:'Chris Martinez — NBA All-Star vs Super Bowl overlap', time:'5 hrs ago', iconKey:'activityResolvedConflict', color:'var(--accent-amber)' },
    { action:'Created event', detail:'UFC 310 — Las Vegas, NV (Feb 10–14)', time:'Yesterday', iconKey:'activityCreatedEvent', color:'var(--accent-purple)' },
    { action:'Updated budget', detail:'NBA All-Star Weekend — Equipment +$12,500', time:'Yesterday', iconKey:'activityUpdatedBudget', color:'var(--accent-amber)' },
    { action:'Booked hotel', detail:'Ritz-Carlton Atlanta — 5 rooms for NBA crew', time:'2 days ago', iconKey:'activityBookedHotel', color:'var(--accent-green)' },
    { action:'Uploaded document', detail:'Taylor Swift NYC — Client rider (5.8 MB)', time:'2 days ago', iconKey:'activityUploadedDoc', color:'var(--accent-blue)' },
    { action:'Invited user', detail:'jake@acmeproductions.com as Crew Lead', time:'3 days ago', iconKey:'activityInvitedUser', color:'var(--accent-cyan)' },
    { action:'Settled event', detail:'Taylor Swift NYC Concert — Under budget by $14,600', time:'4 days ago', iconKey:'activitySettledEvent', color:'var(--accent-green)' },
  ];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-tertiary);">Your recent actions across the platform.</div>
      <select class="filter-select" style="width:auto;"><option>All Activity</option><option>Events</option><option>Documents</option><option>Travel</option><option>Settings</option></select>
    </div>
    <div style="position:relative;">
      <div style="position:absolute;left:15px;top:0;bottom:0;width:2px;background:var(--border-subtle);"></div>
      ${logs.map(l => `
        <div style="display:flex;gap:12px;padding:10px 0;position:relative;">
          <div style="width:32px;height:32px;border-radius:50%;background:${l.color}20;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;position:relative;z-index:1;">${uiIcon(l.iconKey)}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">${l.action}</div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:1px;">${l.detail}</div>
          </div>
          <div style="font-size:11px;color:var(--text-tertiary);white-space:nowrap;flex-shrink:0;">${l.time}</div>
        </div>
      `).join('')}
    </div>
  `;
}
