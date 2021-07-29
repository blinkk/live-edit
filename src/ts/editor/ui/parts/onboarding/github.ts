import {BasePart, UiPartComponent, UiPartConfig} from '..';
import {DashboardRecent, STORAGE_RECENT} from '../dashboard';
import {
  GitHubInstallationInfo,
  GitHubOrgInstallationInfo,
  ProjectData,
  UserData,
  WorkspaceData,
} from '../../../api';
import {TemplateResult, classMap, html, repeat} from '@blinkk/selective-edit';

import {EVENT_ONBOARDING_UPDATE} from '../../../events';
import {EditorState} from '../../../state';
import {GitHubApi} from '../../../../server/gh/githubApi';
import TimeAgo from 'javascript-time-ago';
import {githubIcon} from '../../icons';
import {templateLoading} from '../../../template';

const APP_URL = 'https://github.com/apps/editor-dev';
const BASE_URL = '/gh/';
const MIN_FILTER_LENGTH = 9;

export interface GitHubOnboardingPartConfig extends UiPartConfig {
  /**
   * State class for working with editor state.
   */
  state: EditorState;
}

export class GitHubOnboardingPart extends BasePart implements UiPartComponent {
  config: GitHubOnboardingPartConfig;
  organizations?: Array<GitHubInstallationInfo>;
  installation?: GitHubInstallationInfo;
  /**
   * Value to filter the list of results for.
   */
  listFilter?: string;
  repositories?: Array<GitHubOrgInstallationInfo>;
  /**
   * Track the id that was used to load the repositories.
   * Reset the loaded repositories when the id does not match.
   * ex: on pop state.
   */
  repositoriesId?: number;
  service = 'GitHub';
  timeAgo: TimeAgo;
  users?: Array<UserData>;
  workspaces?: Array<WorkspaceData>;
  /**
   * Track the id that was used to load the workspaces.
   * Reset the loaded workspaces when the id does not match.
   * ex: on pop state.
   */
  workspacesId?: string;

  constructor(config: GitHubOnboardingPartConfig) {
    super();
    this.config = config;
    this.timeAgo = new TimeAgo('en-US');

    // Update current state with onboarding flag.
    history.replaceState(
      Object.assign({}, history.state || {}, {
        onboarding: true,
      }),
      history.state?.title || document.title
    );

    // Watch for the history popstate.
    window.addEventListener('popstate', this.handlePopstate.bind(this));
  }

  get api(): GitHubApi {
    return this.config.editor.api as GitHubApi;
  }

  classesForPart(): Record<string, boolean> {
    return {
      le__part__onboarding__github: true,
    };
  }

  generateUrl(
    organization?: string,
    repository?: string,
    workspace?: string
  ): string {
    if (organization && repository && workspace) {
      return `${BASE_URL}${organization}/${repository}/${workspace}/`;
    } else if (organization && repository) {
      return `${BASE_URL}${organization}/${repository}/`;
    } else if (organization) {
      return `${BASE_URL}${organization}/`;
    }
    return BASE_URL;
  }

  handleFilterInput(evt: Event) {
    this.listFilter = (evt.target as HTMLInputElement).value;
    this.render();
  }

  handleKeyboardNav(evt: KeyboardEvent) {
    if (evt.key === 'Enter' || evt.key === ' ') {
      (evt.target as HTMLElement).click();
    }
  }

  handlePopstate(evt: PopStateEvent) {
    // When using popstate update the onboarding flow to the state values.
    if (evt.state.onboarding === true) {
      this.api.organization = evt.state.organization || undefined;
      this.api.project = evt.state.repository || undefined;
      this.api.branch = evt.state.branch || undefined;
      this.config.state.checkOnboarding();
    }
  }

  loadWorkspaces() {
    this.api
      .getWorkspaces(this.api.organization, this.api.project)
      .then(workspaces => {
        this.workspaces = workspaces;
        this.workspacesId = this.api.project;
        this.render();
      })
      .catch(() => {
        console.error('Unable to retrieve the list of branches.');
      });
  }

  loadOrganizations() {
    this.api
      .getOrganizations()
      .then(organizations => {
        this.organizations = organizations;
        this.render();
      })
      .catch(() => {
        console.error('Unable to retrieve the list of organizations.');
      });
  }

  loadRepositories() {
    if (!this.organizations) {
      this.loadOrganizations();
    }

    // Search for the organization in the organization installations.
    if (!this.installation && this.api.organization && this.organizations) {
      for (const organization of this.organizations) {
        if (organization.org === this.api.organization) {
          this.installation = organization;
          break;
        }
      }

      // Unable to find the installation in the installations. Not installed.
      if (!this.installation) {
        console.error('No installation found for ', this.api.organization);
        this.repositories = [];
        this.render();
        return;
      }
    }

    // If the installation id has not been set the installations are loading.
    if (!this.installation) {
      return;
    }

    this.api
      .getRepositories(this.installation.id)
      .then(repositories => {
        this.repositories = repositories;
        this.repositoriesId = this.installation?.id;
        this.render();
      })
      .catch(() => {
        console.error('Unable to retrieve the list of repositories.');
      });
  }

  loadProject() {
    this.users = this.config.state.getProject((project: ProjectData) => {
      // Default to array so it does not try to keep reloading the project data.
      this.users = project.users || [];
      this.render();
    })?.users;
  }

  template(): TemplateResult {
    const parts: Array<TemplateResult> = [];

    if (!this.api.checkAuth()) {
      parts.push(this.templateLogin());
    } else if (!this.api.organization) {
      parts.push(this.templateOrganizations());
    } else if (!this.api.project) {
      parts.push(this.templateRepositories());
    } else {
      parts.push(this.templateWorkspaces());
    }

    return html`<div class=${classMap(this.classesForPart())}>${parts}</div>`;
  }

  templateFilter(): TemplateResult {
    return html`<div class="le__part__onboarding__filter">
      <input
        type="text"
        @input=${this.handleFilterInput.bind(this)}
        placeholder="Filter…"
        value=${this.listFilter || ''}
      />
    </div>`;
  }

  templateHeader(title: string): TemplateResult {
    return html`<div class="le__part__onboarding__header">
      <div class="le__part__onboarding__icon">${githubIcon}</div>
      <h1>GitHub</h1>
      <h2>${title}</h2>
    </div>`;
  }

  templateHelp(message: TemplateResult): TemplateResult {
    return html`<div class="le__part__onboarding__help">
      <span class="material-icons">help_outline</span>
      <div class="le__part__onboarding__help__message">${message}</div>
    </div>`;
  }

  templateLoadingStatus(message: TemplateResult): TemplateResult {
    return html`<div class="le__part__onboarding__loading">
      ${templateLoading({padHorizontal: true})} ${message}
    </div>`;
  }

  templateLogin(): TemplateResult {
    return html`${this.templateHeader('Login with GitHub')}
      <div class="le__part__onboarding__github__login">
        <p>Login with your GitHub account to access your files in GitHub.</p>
        <button
          class="le__button le__button--primary"
          href="#"
          @click=${this.api.triggerAuth}
        >
          Login with GitHub
        </button>
      </div>`;
  }

  templateOrganizations(): TemplateResult {
    if (!this.organizations) {
      this.loadOrganizations();
    }

    const useFilter = Boolean(
      this.organizations && this.organizations.length > MIN_FILTER_LENGTH
    );

    // Allow the filter input to filter the repositories.
    let filtered = this.organizations;
    if (
      this.organizations &&
      this.listFilter &&
      this.listFilter.trim() !== ''
    ) {
      filtered = this.organizations.filter(org =>
        org.org.includes(this.listFilter || '')
      );
    }

    return html`${this.templateHeader('Organizations')}
      ${this.templateSectionHeader('Select an organization')}
      ${this.templateHelp(html`Unable to find your organization? Install the
        <a href=${APP_URL}>GitHub App</a>.`)}
      ${this.organizations
        ? ''
        : this.templateLoadingStatus(html`Finding organizations…`)}
      <div class="le__part__onboarding__options">
        ${useFilter ? this.templateFilter() : ''}
        <div
          class=${classMap({
            le__grid: true,
            'le__grid--col-3': true,
            'le__grid--gap_small': useFilter,
            'le__grid--3-2': !useFilter,
          })}
        >
          ${repeat(
            filtered || [],
            org => org.id,
            org => {
              return html`<div
                class=${classMap({
                  le__grid__item: true,
                  'le__grid__item--pad': true,
                  'le__grid__item--box': true,
                  'le__grid__item--box-centered': !useFilter,
                  le__clickable: true,
                })}
                @click=${() => {
                  this.api.organization = org.org;
                  this.installation = org;
                  this.listFilter = undefined;

                  history.pushState(
                    {
                      onboarding: true,
                      organization: this.api.organization,
                    },
                    org.org,
                    this.generateUrl(org.org)
                  );

                  this.render();
                  return false;
                }}
                @keydown=${this.handleKeyboardNav.bind(this)}
                tabindex="0"
                role="button"
                aria-pressed="false"
              >
                <a
                  href="${BASE_URL}${org.org}/"
                  @click=${preventNormalLinks}
                  tabindex="-1"
                  >${org.org}</a
                >
              </div>`;
            }
          )}
          ${this.organizations && !this.organizations.length
            ? html`<div
                class="le__grid__item le__grid__item--pad le__grid__item--emphasis"
              >
                No organization access found.
              </div>`
            : ''}
        </div>
      </div>`;
  }

  templateRecentProjects(): TemplateResult {
    const recent: DashboardRecent =
      this.config.editor.storage.getItemRecord(STORAGE_RECENT) ?? {};

    // Filter down all the recent to just ones that belong to the current
    // organization.
    const recentProjects = (recent.projects ?? []).filter(project =>
      project.startsWith(`${this.api.organization}/`)
    );

    if (!recentProjects.length) {
      return html``;
    }

    return html`${this.templateSectionHeader('Recent projects')}
      <div class="le__part__onboarding__options">
        <div
          class=${classMap({
            le__grid: true,
            'le__grid--col-3': true,
          })}
        >
          ${repeat(
            recentProjects,
            projectId => projectId,
            projectId => {
              return html`<div
                class=${classMap({
                  le__grid__item: true,
                  'le__grid__item--pad': true,
                  'le__grid__item--box': true,
                  'le__grid__item--box-centered': true,
                  le__clickable: true,
                })}
                @click=${() => {
                  const repository = projectId.replace(
                    `${this.api.organization}/`,
                    ''
                  );
                  this.api.project = repository;
                  this.listFilter = undefined;

                  history.pushState(
                    {
                      onboarding: true,
                      organization: this.api.organization,
                      repository: repository,
                    },
                    repository,
                    this.generateUrl(this.api.organization, this.api.project)
                  );

                  this.render();
                  return false;
                }}
                @keydown=${this.handleKeyboardNav.bind(this)}
                tabindex="0"
                role="button"
                aria-pressed="false"
              >
                <a
                  href="${BASE_URL}${projectId}/"
                  @click=${preventNormalLinks}
                  tabindex="-1"
                  >${projectId}</a
                >
              </div>`;
            }
          )}
        </div>
      </div>
      ${this.templateSectionHeader('Available projects')}`;
  }

  templateRepositories(): TemplateResult {
    // When using popstate, the repository id can be different than the cached selection.
    if (
      this.repositories &&
      this.repositoriesId &&
      this.installation?.id !== this.repositoriesId
    ) {
      this.repositories = undefined;
    }

    if (!this.repositories) {
      this.loadRepositories();
    }

    const useFilter = Boolean(
      this.repositories && this.repositories.length > MIN_FILTER_LENGTH
    );

    // Allow the filter input to filter the repositories.
    let filtered = this.repositories;
    if (this.repositories && this.listFilter && this.listFilter.trim() !== '') {
      console.log('filtered!');

      filtered = this.repositories.filter(repo =>
        repo.repo.includes(this.listFilter || '')
      );
    }

    return html`${this.templateHeader(
        `Repositories in ${this.api.organization}`
      )}
      ${this.templateSectionHeader('Select a repository')}
      ${this.templateHelp(html`Repository missing?
      ${this.installation
        ? html`Configure the
            <a href=${this.installation?.url || APP_URL}>GitHub App</a>
            repository access.`
        : html`Install the <a href=${APP_URL}>GitHub App</a>.`}`)}
      ${this.templateRecentProjects()}
      ${this.repositories
        ? ''
        : this.templateLoadingStatus(html`Finding ${this.api.organization}
          repositories…`)}
      <div class="le__part__onboarding__github__list">
        ${useFilter ? this.templateFilter() : ''}
        <div
          class=${classMap({
            le__grid: true,
            'le__grid--col-3': true,
            'le__grid--gap_small': useFilter,
            'le__grid--3-2': !useFilter,
          })}
        >
          ${repeat(
            filtered || [],
            repo => repo.repo,
            repo => {
              const handleClick = () => {
                this.api.project = repo.repo;
                this.listFilter = undefined;

                history.pushState(
                  {
                    onboarding: true,
                    organization: this.api.organization,
                    repository: repo.repo,
                  },
                  repo.repo,
                  this.generateUrl(this.api.organization, repo.repo)
                );

                this.render();
                return false;
              };

              return html`<div
                class=${classMap({
                  le__grid__item: true,
                  'le__grid__item--pad': true,
                  'le__grid__item--box': true,
                  'le__grid__item--box-centered': !useFilter,
                  le__clickable: true,
                })}
                @click=${handleClick}
                @keydown=${this.handleKeyboardNav.bind(this)}
                tabindex="0"
                role="button"
                aria-pressed="false"
              >
                <div>
                  <a
                    href="${BASE_URL}${repo.org}/${repo.repo}/"
                    @click=${preventNormalLinks}
                    tabindex="-1"
                    >${repo.org}/${repo.repo}</a
                  >
                </div>
                ${repo.updatedAt
                  ? html`<div class="le__part__onboarding__github__time">
                      Updated ${this.timeAgo.format(new Date(repo.updatedAt))}
                    </div>`
                  : ''}
              </div>`;
            }
          )}
          ${this.repositories && !this.repositories.length
            ? html`<div
                class="le__grid__item le__grid__item--pad le__grid__item--emphasis"
              >
                No repository access found.
              </div>`
            : ''}
        </div>
      </div>`;
  }

  templateSectionHeader(title: string): TemplateResult {
    return html`<div class="le__part__onboarding__section">
      <h3>${title}</h3>
    </div>`;
  }

  templateWorkspaces(): TemplateResult {
    // When using popstate, the repository id can be different than the cached selection.
    if (
      this.workspaces &&
      this.workspacesId &&
      this.api.project !== this.workspacesId
    ) {
      this.workspaces = undefined;
    }

    const useFilter = Boolean(
      this.workspaces && this.workspaces.length > MIN_FILTER_LENGTH
    );

    if (!this.workspaces) {
      this.loadWorkspaces();
    }

    // Allow the filter input to filter the repositories.
    let filtered = this.workspaces;
    if (this.workspaces && this.listFilter && this.listFilter.trim() !== '') {
      filtered = this.workspaces.filter(workspace =>
        workspace.name.includes(this.listFilter || '')
      );
    }

    return html`${this.templateHeader(
      `Workspaces in ${this.api.organization}/${this.api.project}`
    )}
    ${this.templateSectionHeader('Select a workspace')}
    ${this.templateHelp(html`Workspaces are git branches that begin with
      <code>workspace/</code> or special branches like <code>main</code>,
      <code>staging</code>, or <code>master</code>.`)}
    ${
      this.workspaces
        ? ''
        : this.templateLoadingStatus(html`Finding
          ${this.api.organization}/${this.api.project} workspaces…`)
    }
      <div class="le__part__onboarding__options">
        ${useFilter ? this.templateFilter() : ''}
        <div class=${classMap({
          le__grid: true,
          'le__grid--col-3': true,
          'le__grid--gap_small': useFilter,
          'le__grid--3-2': !useFilter,
        })}>
          ${repeat(
            filtered || [],
            workspace => workspace.name,
            workspace => {
              return html`<div
                class=${classMap({
                  le__grid__item: true,
                  'le__grid__item--pad': true,
                  'le__grid__item--box': true,
                  'le__grid__item--box-centered': !useFilter,
                  le__clickable: true,
                })}
                @click=${() => {
                  this.api.branch = workspace.name;

                  history.pushState(
                    {
                      onboarding: true,
                      organization: this.api.organization,
                      repository: this.api.project,
                      branch: this.api.branch,
                    },
                    workspace.name,
                    this.generateUrl(
                      this.api.organization,
                      this.api.project,
                      this.api.branch
                    )
                  );

                  // Reload the onboarding info. Should have all of the required
                  // onboarding information.
                  document.dispatchEvent(
                    new CustomEvent(EVENT_ONBOARDING_UPDATE)
                  );
                  return false;
                }}
                @keydown=${this.handleKeyboardNav.bind(this)}
                tabindex="0"
                role="button"
                aria-pressed="false"
              >
                <a
                  href=${this.generateUrl(
                    this.api.organization,
                    this.api.project,
                    workspace.name
                  )}
                  @click=${preventNormalLinks}
                  tabindex="-1"
                  >${workspace.name}</a
                >
              </div>`;
            }
          )}
          ${
            this.workspaces && !this.workspaces.length
              ? html`<div
                  class="le__grid__item le__grid__item--pad le__grid__item--emphasis"
                >
                  Unable to find workspaces.
                </div>`
              : ''
          }
        </div>
      </div>
    </div>`;
  }
}

/**
 * Do not want to have normal link clicks redirect, but still want
 * links to be able to be opened in a new tab.
 */
const preventNormalLinks = (evt: KeyboardEvent) => {
  if (evt.ctrlKey || evt.shiftKey || evt.metaKey) {
    // Stop the upstream click handler from triggering.
    evt.stopPropagation();
    return;
  }
  evt.preventDefault();
};
