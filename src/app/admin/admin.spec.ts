import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { AdminComponent } from './admin.component';
import { SupabaseService } from '../core/services/supabase.service';
import { MemberService, Member } from '../core/services/member.service';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { AdminService, AppSettings, AVATAR_COLORS } from '../core/services/admin.service';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    first_name: 'Alice',
    full_name: 'Alice Smith',
    avatar_color: '#C8860A',
    display_order: 0,
    is_admin: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let supabaseServiceSpy: jasmine.SpyObj<SupabaseService>;
  let memberServiceSpy: jasmine.SpyObj<MemberService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let themeServiceSpy: jasmine.SpyObj<ThemeService>;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    supabaseServiceSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    Object.defineProperty(supabaseServiceSpy, 'isConfigured', {
      get: () => true,
      configurable: true,
    });

    memberServiceSpy = jasmine.createSpyObj<MemberService>('MemberService', ['getAllMembers']);
    Object.defineProperty(memberServiceSpy, 'isAdmin', {
      get: () => false,
      configurable: true,
    });
    memberServiceSpy.getAllMembers.and.returnValue(of([]));

    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['setPasscode']);

    themeServiceSpy = jasmine.createSpyObj<ThemeService>('ThemeService', ['apply']);
    Object.defineProperty(themeServiceSpy, 'current', {
      get: () => 'cinema' as const,
      configurable: true,
    });
    Object.defineProperty(themeServiceSpy, 'options', {
      get: () => [
        { value: 'cinema' as const, label: 'Cinema Mode', bg: '#0d0d0d', accent: '#C8860A' },
        { value: 'lobby' as const, label: 'Lobby Mode', bg: '#f5f0e8', accent: '#C8860A' },
      ],
      configurable: true,
    });

    adminServiceSpy = jasmine.createSpyObj<AdminService>('AdminService', [
      'getAppSettings',
      'renameMember',
      'moveMember',
      'addMember',
    ]);
    adminServiceSpy.getAppSettings.and.returnValue(of(null));

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [AdminComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        { provide: SupabaseService, useValue: supabaseServiceSpy },
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ThemeService, useValue: themeServiceSpy },
        { provide: AdminService, useValue: adminServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── ngOnInit ────────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('sets currentTheme from themeService.current', () => {
      expect(component.currentTheme).toBe('cinema');
    });

    it('loads members and app settings when configured', () => {
      expect(memberServiceSpy.getAllMembers).toHaveBeenCalledTimes(1);
      expect(adminServiceSpy.getAppSettings).toHaveBeenCalledTimes(1);
    });

    it('stores appSettings from service response', () => {
      const settings: AppSettings = { id: '1', omdbCallsToday: 42, omdbRefreshInProgress: false };
      adminServiceSpy.getAppSettings.and.returnValue(of(settings));

      const fixture2 = TestBed.createComponent(AdminComponent);
      fixture2.detectChanges();

      expect(fixture2.componentInstance.appSettings).toEqual(settings);
    });

    it('skips data loading and sets isMembersLoading false when not configured', () => {
      Object.defineProperty(supabaseServiceSpy, 'isConfigured', {
        get: () => false,
        configurable: true,
      });
      memberServiceSpy.getAllMembers.calls.reset();
      adminServiceSpy.getAppSettings.calls.reset();

      const fixture2 = TestBed.createComponent(AdminComponent);
      fixture2.detectChanges();
      const component2 = fixture2.componentInstance;

      expect(component2.isMembersLoading).toBeFalse();
      expect(memberServiceSpy.getAllMembers).not.toHaveBeenCalled();
      expect(adminServiceSpy.getAppSettings).not.toHaveBeenCalled();
    });
  });

  // ── Getters ─────────────────────────────────────────────────────────────────

  describe('isConfigured', () => {
    it('delegates to supabaseService.isConfigured', () => {
      expect(component.isConfigured).toBeTrue();
    });
  });

  describe('isAdmin', () => {
    it('delegates to memberService.isAdmin', () => {
      expect(component.isAdmin).toBeFalse();
    });
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  describe('goBack()', () => {
    it('navigates to /home', () => {
      component.goBack();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  // ── Theme ───────────────────────────────────────────────────────────────────

  describe('selectTheme()', () => {
    it('updates currentTheme', () => {
      component.selectTheme('lobby');
      expect(component.currentTheme).toBe('lobby');
    });

    it('applies the theme via themeService', () => {
      component.selectTheme('high-contrast');
      expect(themeServiceSpy.apply).toHaveBeenCalledWith('high-contrast');
    });
  });

  // ── Passcode ─────────────────────────────────────────────────────────────────

  describe('savePasscode()', () => {
    it('sets passcodeError when passcode is fewer than 6 digits', () => {
      component.newPasscode = '123';
      component.savePasscode();
      expect(component.passcodeError).toBe('Passcode must be exactly 6 digits.');
      expect(authServiceSpy.setPasscode).not.toHaveBeenCalled();
    });

    it('sets passcodeError when passcode contains non-digit characters', () => {
      component.newPasscode = '12345a';
      component.savePasscode();
      expect(component.passcodeError).toBe('Passcode must be exactly 6 digits.');
      expect(authServiceSpy.setPasscode).not.toHaveBeenCalled();
    });

    it('clears passcodeError and sets passcodeSaved on success', () => {
      authServiceSpy.setPasscode.and.returnValue(of(true));
      component.newPasscode = '123456';
      component.savePasscode();
      expect(component.passcodeSaved).toBeTrue();
      expect(component.newPasscode).toBe('');
      expect(component.passcodeError).toBe('');
    });

    it('sets passcodeError and leaves passcodeSaved false on failure', () => {
      authServiceSpy.setPasscode.and.returnValue(of(false));
      component.newPasscode = '123456';
      component.savePasscode();
      expect(component.passcodeSaved).toBeFalse();
      expect(component.passcodeError).toBe('Failed to save passcode. Check your connection.');
    });
  });

  // ── Members ──────────────────────────────────────────────────────────────────

  describe('loadMembers()', () => {
    it('populates members and clears loading flag', () => {
      const members = [
        makeMember({ id: '1', display_order: 0 }),
        makeMember({ id: '2', first_name: 'Bob', display_order: 1 }),
      ];
      memberServiceSpy.getAllMembers.and.returnValue(of(members));
      component.loadMembers();
      expect(component.members).toEqual(members);
      expect(component.isMembersLoading).toBeFalse();
    });
  });

  describe('startEdit()', () => {
    it('sets editingMemberId, editFirstName, and editFullName from the member', () => {
      const member = makeMember({ id: 'abc', first_name: 'Carol', full_name: 'Carol White' });
      component.startEdit(member);
      expect(component.editingMemberId).toBe('abc');
      expect(component.editFirstName).toBe('Carol');
      expect(component.editFullName).toBe('Carol White');
    });
  });

  describe('cancelEdit()', () => {
    it('clears editingMemberId', () => {
      component.editingMemberId = 'abc';
      component.cancelEdit();
      expect(component.editingMemberId).toBeNull();
    });
  });

  describe('saveMemberName()', () => {
    it('does nothing when editingMemberId is null', () => {
      component.editingMemberId = null;
      component.saveMemberName();
      expect(adminServiceSpy.renameMember).not.toHaveBeenCalled();
    });

    it('does nothing when editFirstName is blank', () => {
      component.editingMemberId = 'abc';
      component.editFirstName = '   ';
      component.saveMemberName();
      expect(adminServiceSpy.renameMember).not.toHaveBeenCalled();
    });

    it('calls renameMember with the correct arguments', () => {
      adminServiceSpy.renameMember.and.returnValue(of(true));
      component.editingMemberId = 'abc';
      component.editFirstName = 'Alice';
      component.editFullName = 'Alice Smith';
      component.saveMemberName();
      expect(adminServiceSpy.renameMember).toHaveBeenCalledWith('abc', 'Alice', 'Alice Smith');
    });

    it('clears editingMemberId and reloads members on success', () => {
      adminServiceSpy.renameMember.and.returnValue(of(true));
      memberServiceSpy.getAllMembers.calls.reset();
      component.editingMemberId = 'abc';
      component.editFirstName = 'Alice';
      component.saveMemberName();
      expect(component.editingMemberId).toBeNull();
      expect(memberServiceSpy.getAllMembers).toHaveBeenCalledTimes(1);
    });

    it('keeps editingMemberId and does not reload on failure', () => {
      adminServiceSpy.renameMember.and.returnValue(of(false));
      memberServiceSpy.getAllMembers.calls.reset();
      component.editingMemberId = 'abc';
      component.editFirstName = 'Alice';
      component.saveMemberName();
      expect(component.editingMemberId).toBe('abc');
      expect(memberServiceSpy.getAllMembers).not.toHaveBeenCalled();
    });
  });

  describe('moveMember()', () => {
    it('reloads members on success', () => {
      const member = makeMember();
      adminServiceSpy.moveMember.and.returnValue(of(true));
      memberServiceSpy.getAllMembers.calls.reset();
      component.moveMember(member, 'up');
      expect(memberServiceSpy.getAllMembers).toHaveBeenCalledTimes(1);
    });

    it('does not reload members on failure', () => {
      const member = makeMember();
      adminServiceSpy.moveMember.and.returnValue(of(false));
      memberServiceSpy.getAllMembers.calls.reset();
      component.moveMember(member, 'down');
      expect(memberServiceSpy.getAllMembers).not.toHaveBeenCalled();
    });

    it('passes the member, direction, and current members list to adminService', () => {
      const member = makeMember();
      adminServiceSpy.moveMember.and.returnValue(of(false));
      component.members = [member];
      component.moveMember(member, 'down');
      expect(adminServiceSpy.moveMember).toHaveBeenCalledWith(member, 'down', [member]);
    });
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  describe('initial()', () => {
    it('returns the uppercased first character of first_name', () => {
      expect(component.initial(makeMember({ first_name: 'alice' }))).toBe('A');
      expect(component.initial(makeMember({ first_name: 'Bob' }))).toBe('B');
    });
  });

  describe('isFirst()', () => {
    it('returns true for the member with the lowest display_order', () => {
      const a = makeMember({ id: '1', display_order: 0 });
      const b = makeMember({ id: '2', display_order: 1 });
      component.members = [b, a];
      expect(component.isFirst(a)).toBeTrue();
      expect(component.isFirst(b)).toBeFalse();
    });
  });

  describe('isLast()', () => {
    it('returns true for the member with the highest display_order', () => {
      const a = makeMember({ id: '1', display_order: 0 });
      const b = makeMember({ id: '2', display_order: 1 });
      component.members = [b, a];
      expect(component.isLast(b)).toBeTrue();
      expect(component.isLast(a)).toBeFalse();
    });
  });

  describe('trackById()', () => {
    it('returns the member id', () => {
      const member = makeMember({ id: 'xyz' });
      expect(component.trackById(0, member)).toBe('xyz');
    });
  });

  // ── Add member form ──────────────────────────────────────────────────────────

  describe('toggleAddForm()', () => {
    it('shows the form when hidden and resets all fields', () => {
      component.showAddForm = false;
      component.addFirstName = 'Bob';
      component.addFullName = 'Bob Jones';
      component.addError = 'some error';
      component.addSuccess = true;
      component.toggleAddForm();
      expect(component.showAddForm).toBeTrue();
      expect(component.addFirstName).toBe('');
      expect(component.addFullName).toBe('');
      expect(component.addAvatarColor).toBe(AVATAR_COLORS[0]);
      expect(component.addError).toBe('');
      expect(component.addSuccess).toBeFalse();
    });

    it('hides the form when shown', () => {
      component.showAddForm = true;
      component.toggleAddForm();
      expect(component.showAddForm).toBeFalse();
    });
  });

  describe('addMember()', () => {
    it('sets addError and does not call service when first name is blank', () => {
      component.addFirstName = '  ';
      component.addMember();
      expect(component.addError).toBe('First name is required.');
      expect(adminServiceSpy.addMember).not.toHaveBeenCalled();
    });

    it('uses addFirstName as fullName when addFullName is empty', () => {
      adminServiceSpy.addMember.and.returnValue(of(makeMember()));
      component.addFirstName = 'Alice';
      component.addFullName = '';
      component.addAvatarColor = '#C8860A';
      component.addMember();
      expect(adminServiceSpy.addMember).toHaveBeenCalledWith(
        'Alice', 'Alice', '#C8860A', component.members
      );
    });

    it('uses addFullName when provided', () => {
      adminServiceSpy.addMember.and.returnValue(of(makeMember()));
      component.addFirstName = 'Alice';
      component.addFullName = 'Alice Smith';
      component.addAvatarColor = '#C8860A';
      component.addMember();
      expect(adminServiceSpy.addMember).toHaveBeenCalledWith(
        'Alice', 'Alice Smith', '#C8860A', component.members
      );
    });

    it('sets addSuccess, hides form, and reloads members on success', () => {
      adminServiceSpy.addMember.and.returnValue(of(makeMember()));
      memberServiceSpy.getAllMembers.calls.reset();
      component.addFirstName = 'Alice';
      component.addMember();
      expect(component.addSuccess).toBeTrue();
      expect(component.showAddForm).toBeFalse();
      expect(memberServiceSpy.getAllMembers).toHaveBeenCalledTimes(1);
    });

    it('sets addError and does not set addSuccess on failure', () => {
      adminServiceSpy.addMember.and.returnValue(of(null));
      component.addFirstName = 'Alice';
      component.addMember();
      expect(component.addError).toBe('Failed to add member. Check your connection.');
      expect(component.addSuccess).toBeFalse();
    });
  });
});
