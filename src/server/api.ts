import {
  DeviceData,
  EditorFileData,
  FileData,
  LiveEditorApiComponent,
  ProjectData,
  PublishResult,
  WorkspaceData,
} from '../editor/api';
import {SessionDataStorage} from '../utility/dataStorage';
import bent from 'bent';

const postJSON = bent('json', 'POST');
const sessionStorage = new SessionDataStorage();

/**
 * Example api that returns data through a 'simulated' network.
 */
export class ServerApi implements LiveEditorApiComponent {
  get baseUrl() {
    return '/';
  }

  expandParams(params: Record<string, any>): Record<string, any> {
    // TODO: this should be specific to the service.
    params['githubState'] = sessionStorage.getItem('github.state');
    params['githubCode'] = sessionStorage.getItem('github.code');
    return params;
  }

  async copyFile(originalPath: string, path: string): Promise<FileData> {
    return postJSON(
      this.resolveUrl('/file.copy'),
      this.expandParams({
        originalPath: originalPath,
        path: path,
      })
    ) as Promise<FileData>;
  }

  async createFile(path: string): Promise<FileData> {
    return postJSON(
      this.resolveUrl('/file.create'),
      this.expandParams({
        path: path,
      })
    ) as Promise<FileData>;
  }

  async createWorkspace(
    base: WorkspaceData,
    workspace: string
  ): Promise<WorkspaceData> {
    return postJSON(
      this.resolveUrl('/workspace.create'),
      this.expandParams({
        base: base,
        workspace: workspace,
      })
    ) as Promise<WorkspaceData>;
  }

  async deleteFile(file: FileData): Promise<null> {
    return postJSON(
      this.resolveUrl('/file.delete'),
      this.expandParams({
        file: file,
      })
    ) as Promise<null>;
  }

  async getDevices(): Promise<Array<DeviceData>> {
    return postJSON(
      this.resolveUrl('/devices.get'),
      this.expandParams({})
    ) as Promise<Array<DeviceData>>;
  }

  async getFile(file: FileData): Promise<EditorFileData> {
    return postJSON(
      this.resolveUrl('/file.get'),
      this.expandParams({
        file: file,
      })
    ) as Promise<EditorFileData>;
  }

  async getFiles(): Promise<Array<FileData>> {
    return postJSON(
      this.resolveUrl('/files.get'),
      this.expandParams({})
    ) as Promise<Array<FileData>>;
  }

  async getFileUrl(file: FileData): Promise<FileData> {
    // TODO: Use preview server to determine urls for files.
    return Promise.resolve({
      path: file.path,
      url: 'image-landscape.png',
    } as FileData);
  }

  async getProject(): Promise<ProjectData> {
    return postJSON(
      this.resolveUrl('/project.get'),
      this.expandParams({})
    ) as Promise<ProjectData>;
  }

  async getWorkspace(): Promise<WorkspaceData> {
    return postJSON(
      this.resolveUrl('/workspace.get'),
      this.expandParams({})
    ) as Promise<WorkspaceData>;
  }

  async getWorkspaces(): Promise<Array<WorkspaceData>> {
    return postJSON(
      this.resolveUrl('/workspaces.get'),
      this.expandParams({})
    ) as Promise<Array<WorkspaceData>>;
  }

  async loadWorkspace(workspace: WorkspaceData): Promise<WorkspaceData> {
    // TODO: Handle the redirection of the URL when loading a workspace.
    return Promise.resolve(workspace);
  }

  async publish(
    workspace: WorkspaceData,
    data?: Record<string, any>
  ): Promise<PublishResult> {
    return postJSON(
      this.resolveUrl('/publish.start'),
      this.expandParams({
        workspace: workspace,
        data: data,
      })
    ) as Promise<PublishResult>;
  }

  resolveUrl(path: string) {
    // Strip off the preceding /.
    path = path.replace(/\/*/, '');
    return `${this.baseUrl}${path}`;
  }

  async saveFile(file: EditorFileData): Promise<EditorFileData> {
    return postJSON(
      this.resolveUrl('/file.save'),
      this.expandParams({
        file: file,
      })
    ) as Promise<EditorFileData>;
  }

  async uploadFile(file: File, meta?: Record<string, any>): Promise<FileData> {
    return postJSON(
      this.resolveUrl('/file.upload'),
      this.expandParams({
        file: file,
        meta: meta,
      })
    ) as Promise<FileData>;
  }
}

/**
 * Connects to a locally running version of the api.
 *
 * This is used when a user is running `npx @blinkk/editor-server` locally.
 */
export class LocalServerApi extends ServerApi {
  port: number;

  constructor(port: number) {
    super();
    this.port = port;
  }

  get baseUrl() {
    return `http://localhost:${this.port}/`;
  }
}

/**
 * Connects to the corresponding api server and maps to the right service
 * api for the request urls.
 */
export class ServiceServerApi extends ServerApi {
  branch: string;
  isUnstable: boolean;
  organization: string;
  project: string;
  service: string;

  constructor(
    service: string,
    organization: string,
    project: string,
    branch?: string
  ) {
    super();
    this.service = service;
    this.organization = organization;
    this.project = project;
    this.branch = branch || 'main';
    this.isUnstable = true;
  }

  get baseUrl() {
    const domain = `https://api.${this.isUnstable ? 'beta.' : ''}editor.dev`;
    const path = `/${this.service}/${this.organization}/${this.project}/${this.branch}/`;
    return `${domain}${path}`;
  }
}

/**
 * Used for developing the service api locally when in development mode.
 */
export class DevServiceServerApi extends ServiceServerApi {
  get baseUrl() {
    const domain = 'http://localhost:9090';
    const path = `/${this.service}/${this.organization}/${this.project}/${this.branch}/`;
    return `${domain}${path}`;
  }
}
