/* eslint-disable global-require */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type * as whichTypes from 'which';
import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../../../activation/types';
import { Commands } from '../../../../../common/constants';
import { IDisposableRegistry } from '../../../../../common/types';
import { ITerminalServiceFactory } from '../../../../../common/terminal/types';
import { ICommandManager } from '../../../../../common/application/types';
import { sleep } from '../../../../../common/utils/async';
import { OSType } from '../../../../../common/utils/platform';
import { traceVerbose } from '../../../../../logging';

/**
 * Runs commands listed in walkthrough to install Python.
 */
@injectable()
export class InstallPythonViaTerminal implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: false };

    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(ITerminalServiceFactory) private readonly terminalServiceFactory: ITerminalServiceFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {}

    public async activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.InstallPythonOnMac, () =>
                this._installPythonOnUnix(OSType.OSX),
            ),
        );
        this.disposables.push(
            this.commandManager.registerCommand(Commands.InstallPythonOnLinux, () =>
                this._installPythonOnUnix(OSType.Linux),
            ),
        );
    }

    public async _installPythonOnUnix(os: OSType.Linux | OSType.OSX): Promise<void> {
        const terminalService = this.terminalServiceFactory.getTerminalService({});
        const commands = await getCommands(os);
        for (const command of commands) {
            await terminalService.sendText(command);
            await waitForCommandToProcess();
        }
    }
}

async function getCommands(os: OSType.Linux | OSType.OSX) {
    if (os === OSType.OSX) {
        return ['brew install python3'];
    }
    return getCommandsForLinux();
}

async function getCommandsForLinux() {
    let isDnfAvailable = false;
    try {
        const which = require('which') as typeof whichTypes;
        const resolvedPath = await which('dnf');
        traceVerbose('Resolved path to dnf module:', resolvedPath);
        isDnfAvailable = resolvedPath.trim().length > 0;
    } catch (ex) {
        traceVerbose('Dnf not found', ex);
        isDnfAvailable = false;
    }
    return isDnfAvailable
        ? ['sudo dnf install python3']
        : ['sudo apt-get update', 'sudo apt-get install python3 python3-venv python3-pip'];
}

async function waitForCommandToProcess() {
    // Give the command some time to complete.
    // Its been observed that sending commands too early will strip some text off in VS Code Terminal.
    await sleep(500);
}
