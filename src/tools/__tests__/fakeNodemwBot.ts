/*
 * SPDX-License-Identifier: BSD-2-Clause
 *
 * Copyright (c) 2026 Xie Youtian
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Offline stand-in for src/common/nodemwBot.js used by the tool smoke tests.
 *
 * The fake bot answers every nodemw method with a "hybrid" result: an array
 * of one rich item that also carries common object fields. That satisfies
 * handlers that iterate list results as well as handlers that destructure an
 * object, without enumerating all of nodemw's API surface. Callbacks fire on
 * process.nextTick, mimicking async I/O so the promisified call paths are
 * genuinely exercised.
 */

export const PAGE_ID = 1;
export const CONTENT = 'Test content\n';
export const REVID = 100;

const PAGE = {
    pageid: PAGE_ID,
    ns: 0,
    title: 'Test Page',
    lastrevid: REVID,
    touch: '2026-09-01T00:00:00Z',
};

const REVISION = {
    revid: REVID,
    parentid: 99,
    minor: '',
    user: 'TestUser',
    userid: 10,
    timestamp: '2026-09-01T00:00:00Z',
    comment: 'test',
    '*': CONTENT,
};

const LIST_ITEM = {
    ...PAGE,
    revid: REVID,
    parentid: 99,
    user: 'TestUser',
    userid: 10,
    timestamp: '2026-09-01T00:00:00Z',
    comment: 'test',
    snippet: 'Test content',
    wordcount: 2,
    size: 13,
    filename: 'Test.png',
    name: 'Test Page',
    url: 'https://test.local/images/Test.png',
    descriptionurl: 'https://test.local/index.php/File:Test.png',
    type: 'edit',
    action: 'edit',
    logid: 1,
    logparams: {},
    category: 'Test Category',
    template: 'Template:Test',
    from: 'Test Page',
    to: 'Moved Page',
    special: { filename: 'Test.png' },
};

const OBJECT_FIELDS = {
    title: 'Test Page',
    pageid: PAGE_ID,
    ns: 0,
    result: 'Success',
    status: 'PASS',
    contentmodel: 'wikitext',
    oldrevid: 99,
    newrevid: 101,
    newtimestamp: '2026-09-02T00:00:00Z',
    revid: REVID,
    realname: '',
    editcount: 42,
    groups: ['bot'],
    rights: ['edit', 'upload'],
    id: 10,
    name: 'TestUser',
    username: 'TestUser',
    userid: 10,
    general: { server: 'test.local', generator: 'MediaWiki 1.43.0' },
    statistics: { pages: 1, articles: 1, edits: 10, users: 1, images: 1 },
    tokens: { csrftoken: 'fake-csrf-token' },
    userinfo: { id: 10, name: 'TestUser', groups: ['bot'], rights: ['edit'] },
    wikitext: 'Expanded content',
    'new-topic': { status: 'ok', workflow: 'wf1' },
    reason: '',
    expiry: 'indefinite',
    blockid: 1,
    filenames: ['Test.png'],
};

function hybridResult(): unknown {
    return Object.assign([JSON.parse(JSON.stringify(LIST_ITEM))], OBJECT_FIELDS);
}

function fakeApiCall(
    params: Record<string, unknown>,
    callback: (err: Error | null, info: unknown, next: unknown, data: unknown) => void
): void {
    let data: unknown = {};
    switch (params.action) {
        case 'query':
            data = {
                query: {
                    pages: { [String(PAGE_ID)]: { ...PAGE, revisions: [REVISION] } },
                    userinfo: OBJECT_FIELDS.userinfo,
                    tokens: OBJECT_FIELDS.tokens,
                    users: [{ userid: 10, name: 'TestUser', groups: ['bot'], editcount: 42 }],
                    recentchanges: [{ type: 'edit', title: 'Test Page', pageid: PAGE_ID, revid: 101, timestamp: '2026-09-02T00:00:00Z' }],
                    logevents: [{ logid: 1, type: 'edit', action: 'edit', title: 'Test Page', timestamp: '2026-09-02T00:00:00Z' }],
                    usercontribs: [{ userid: 10, user: 'TestUser', pageid: PAGE_ID, revid: 101, title: 'Test Page', timestamp: '2026-09-02T00:00:00Z' }],
                    blocks: [],
                    search: [],
                    allpages: [],
                    categorymembers: [],
                    backlinks: [],
                    extlinks: [],
                    imageusage: [],
                    prefixsearch: [],
                    transcludedin: [],
                    categories: [],
                    images: [],
                    imageinfo: [],
                    langlinks: [],
                    links: [],
                    general: OBJECT_FIELDS.general,
                    namespaces: {},
                    statistics: OBJECT_FIELDS.statistics,
                },
            };
            break;
        case 'parse':
            data = {
                parse: {
                    title: 'Test Page',
                    pageid: PAGE_ID,
                    revid: REVID,
                    text: { '*': '<p>Parsed content</p>' },
                    langlinks: [],
                    categories: [],
                    links: [],
                    images: [],
                    externallinks: [],
                    sections: [],
                    templates: [],
                },
            };
            break;
        case 'expandtemplates':
            data = { expandtemplates: { title: 'Test Page', wikitext: 'Expanded content' } };
            break;
        case 'edit':
            data = { edit: { result: 'Success', pageid: PAGE_ID, title: 'Test Page', contentmodel: 'wikitext', oldrevid: 99, newrevid: 101, newtimestamp: '2026-09-02T00:00:00Z' } };
            break;
        case 'block':
            data = { block: { userid: 10, name: params.username ?? 'TestUser', expiry: 'indefinite' } };
            break;
        case 'unblock':
            data = { unblock: { userid: 10, name: params.username ?? 'TestUser' } };
            break;
        case 'undelete':
            data = { undelete: { title: 'Test Page', revisions: 2, fileversions: 0, reason: params.reason ?? '' } };
            break;
        case 'protect':
            data = {
                protect: {
                    title: 'Test Page',
                    reason: params.reason ?? '',
                    protections: [{ type: 'edit', level: 'sysop', expiry: 'infinite' }],
                },
            };
            break;
        case 'purge':
            data = { purge: [{ ns: 0, title: 'Test Page', purged: true }] };
            break;
        case 'createaccount':
            data = { createaccount: { username: params.username ?? 'NewUser', status: 'PASS' } };
            break;
        case 'move':
            data = { move: { from: 'Test Page', to: params.to ?? 'Moved Page', reason: params.reason ?? '' } };
            break;
        case 'emailuser':
            data = { emailuser: { result: 'Success' } };
            break;
        case 'compare':
            data = {
                compare: {
                    fromrevid: 100,
                    torevid: 101,
                    fromtitle: 'Test Page',
                    totitle: 'Test Page',
                    fromuser: 'TestUser',
                    touser: 'OtherUser',
                    fromcomment: 'test',
                    tocomment: 'test',
                    fromtimestamp: '2026-09-01T00:00:00Z',
                    totimestamp: '2026-09-02T00:00:00Z',
                    // Mirrors the real action=compare HTML fragment (verified
                    // against zh.minecraft.wiki): localized diff-lineno pair,
                    // context side pair, marker + inline diffchange row.
                    '*': '<tr>'
                        + '<td colspan="2" class="diff-lineno">第1行：</td>'
                        + '<td colspan="2" class="diff-lineno">第1行：</td>'
                        + '</tr>'
                        + '<tr>'
                        + '<td class="diff-marker"></td>'
                        + '<td class="diff-context diff-side-deleted">Context line</td>'
                        + '<td class="diff-marker"></td>'
                        + '<td class="diff-context diff-side-added">Context line</td>'
                        + '</tr>'
                        + '<tr>'
                        + '<td class="diff-marker" data-marker="−"></td>'
                        + '<td class="diff-deletedline">old value <del class="diffchange diffchange-inline">BE</del></td>'
                        + '<td class="diff-marker" data-marker="+"></td>'
                        + '<td class="diff-addedline">new value <ins class="diffchange diffchange-inline">BE2</ins></td>'
                        + '</tr>',
                },
            };
            break;
        default:
            break;
    }
    process.nextTick(() => callback(null, undefined, undefined, data));
}

function createFakeBot(): Record<string, unknown> {
    // Realistic shapes for the nodemw methods the tool handlers destructure;
    // everything else falls back to the hybrid array/object result.
    const EDIT_RESULT = {
        result: 'Success',
        title: 'Test Page',
        pageid: PAGE_ID,
        contentmodel: 'wikitext',
        oldrevid: 99,
        newrevid: 101,
        newtimestamp: '2026-09-02T00:00:00Z',
    };
    const METHOD_RETURNS: Record<string, unknown> = {
        getArticle: CONTENT,
        getArticleInfo: [{ ...PAGE, revisions: [REVISION] }],
        getCategories: ['Test Category'],
        getArticleCategories: ['Test Category'],
        getExternalLinks: [{ '*': 'https://example.org/link' }],
        getImageInfo: {
            name: 'Test.png',
            url: 'https://test.local/images/Test.png',
            descriptionurl: 'https://test.local/index.php/File:Test.png',
            width: 100,
            height: 100,
            size: 8,
            mime: 'image/png',
            sha1: 'fakehash',
            timestamp: '2026-09-01T00:00:00Z',
        },
        getMediaWikiVersion: '1.43.0',
        getSiteInfo: { general: { server: 'test.local', generator: 'MediaWiki 1.43.0' } },
        getSiteStats: { pages: 1, articles: 1, edits: 10, users: 1, images: 1, views: 0, jobs: 0 },
        getArticleProperties: { someprop: 'somevalue' },
        whoami: { id: 10, name: 'TestUser', groups: ['bot'], rights: ['edit'] },
        whois: { userid: 10, name: 'TestUser', groups: ['bot'], editcount: 42, realname: '' },
        doEdit: EDIT_RESULT,
        edit: EDIT_RESULT,
        move: { from: 'Test Page', to: 'Moved Page', reason: '', redirectcreated: false },
        delete: { title: 'Test Page', reason: '[nodemw-mcp.delete] test delete', logid: 1 },
        sendEmail: { result: 'Success' },
        upload: { result: 'Success', filename: 'Test.png', imageinfo: { url: 'https://test.local/images/Test.png' } },
        uploadByUrl: { result: 'Success', filename: 'Test.png' },
        createAccount: { username: 'NewUser', status: 'PASS', userid: 11 },
        addFlowTopic: { 'new-topic': { status: 'ok', workflow: 'wf1' } },
    };

    const callbackStyle = (result: unknown) =>
        (...args: unknown[]) => {
            const cb = [...args].reverse().find((a) => typeof a === 'function') as
                | ((err: Error | null, data: unknown) => void)
                | undefined;
            if (cb) {
                process.nextTick(() => cb(null, result === undefined ? hybridResult() : result));
            }
            return result;
        };

    return new Proxy(
        {
            api: {
                call: fakeApiCall,
                // Some code paths probe for these; absent is fine, but keep
                // them callable to avoid surprises.
                getDefaultRequestOptions: () => ({}),
            },
        },
        {
            get(target, prop) {
                if (typeof prop === 'symbol') return undefined;
                if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
                if (prop in target) return (target as Record<string, unknown>)[prop as string];
                if (typeof prop === 'string' && prop in METHOD_RETURNS) {
                    return callbackStyle(METHOD_RETURNS[prop]);
                }
                return callbackStyle(undefined);
            },
        }
    );
}

/** Build the module shape of src/common/nodemwBot.js backed by the fake bot. */
export function createNodemwBotMock(): Record<string, unknown> {
    let bot: Record<string, unknown> | null = null;

    function ensureBot(): Record<string, unknown> {
        if (!bot) bot = createFakeBot();
        return bot;
    }

    return {
        getBot: () => ensureBot(),
        initBot: async () => ensureBot(),
        clearBotCache: () => {
            bot = null;
        },
        promisifyBotMethod: (botInstance: Record<string, unknown>, method: string, ...args: unknown[]) =>
            new Promise((resolve, reject) => {
                const callback = (err: Error | null, result: unknown) => (err ? reject(err) : resolve(result));
                const fn = botInstance[method];
                if (typeof fn !== 'function') {
                    reject(new Error(`Method ${method} not found on bot`));
                    return;
                }
                fn(...args, callback);
            }),
        fetchWhoami: async () => ({ userinfo: OBJECT_FIELDS.userinfo as unknown }),
        isWhoamiAuthenticated: () => true,
        isAuthenticated: () => true,
        startLoginHeartbeat: () => undefined,
        stopLoginHeartbeat: () => undefined,
        initServerConfig: () => undefined,
        getServerConfig: () => ({ server: 'test.local', path: '/w' }),
        autoDetectPath: async () => '/w',
        setMediaWikiVersion: () => undefined,
        getMediaWikiVersion: () => 1.43,
        setNamespaceCache: () => undefined,
        lookupNamespaceId: () => null,
    };
}
