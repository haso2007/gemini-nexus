import {
    buildHistoryImportStorageUpdate,
    buildSettingsImportStorageUpdate,
} from '../../shared/data_management/index.js';
import { getRuntimeLastError } from './bridge_storage.js';

function postDataImportResult(frame, kind, ok, error = null) {
    frame.postMessage({
        action: 'DATA_IMPORT_RESULT',
        payload: {
            kind,
            ok,
            error: error?.message || null,
        },
    });
}

function writeImportedStorage(frame, kind, storageUpdate, onComplete = null) {
    let settled = false;
    const complete = () => {
        if (settled) return;
        settled = true;
        const writeError = getRuntimeLastError();
        if (!writeError) onComplete?.(storageUpdate);
        postDataImportResult(frame, kind, !writeError, writeError);
    };
    const fail = (error) => {
        if (settled) return;
        settled = true;
        postDataImportResult(frame, kind, false, error);
    };

    try {
        const writeResult = chrome.storage.local.set(storageUpdate, complete);
        if (writeResult && typeof writeResult.then === 'function') {
            writeResult.then(complete).catch(fail);
        }
    } catch (error) {
        fail(error);
    }
}

export function importHistoryData(frame, payload) {
    chrome.storage.local.get(
        ['geminiSessions', 'geminiGroups', 'geminiDeletedSessionIds'],
        (result) => {
            const readError = getRuntimeLastError();
            if (readError) {
                postDataImportResult(frame, 'history', false, readError);
                return;
            }

            try {
                const storageUpdate = buildHistoryImportStorageUpdate(payload, result || {});
                writeImportedStorage(frame, 'history', storageUpdate);
            } catch (error) {
                postDataImportResult(frame, 'history', false, error);
            }
        }
    );
}

export function importSettingsData(frame, payload, onComplete = null) {
    try {
        const storageUpdate = buildSettingsImportStorageUpdate(payload);
        writeImportedStorage(frame, 'settings', storageUpdate, onComplete);
    } catch (error) {
        postDataImportResult(frame, 'settings', false, error);
    }
}
