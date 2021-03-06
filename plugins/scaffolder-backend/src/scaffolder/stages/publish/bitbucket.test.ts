/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

jest.mock('./helpers');

import { BitbucketPublisher } from './bitbucket';
import { initRepoAndPush } from './helpers';
import { getVoidLogger } from '@backstage/backend-common';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { msw } from '@backstage/test-utils';

describe('Bitbucket Publisher', () => {
  const logger = getVoidLogger();
  const server = setupServer();
  msw.setupDefaultHandlers(server);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('publish: createRemoteInBitbucketCloud', () => {
    it('should create repo in bitbucket cloud', async () => {
      server.use(
        rest.post(
          'https://api.bitbucket.org/2.0/repositories/project/repo',
          (_, res, ctx) =>
            res(
              ctx.status(200),
              ctx.set('Content-Type', 'application/json'),
              ctx.json({
                links: {
                  html: {
                    href: 'https://bitbucket.org/project/repo',
                  },
                  clone: [
                    {
                      name: 'https',
                      href: 'https://bitbucket.org/project/repo',
                    },
                  ],
                },
              }),
            ),
        ),
      );

      const publisher = await BitbucketPublisher.fromConfig({
        host: 'bitbucket.org',
        username: 'fake-user',
        appPassword: 'fake-token',
      });

      const result = await publisher.publish({
        values: {
          storePath: 'https://bitbucket.org/project/repo',
          owner: 'bob',
        },
        directory: '/tmp/test',
        logger: logger,
      });

      expect(result).toEqual({
        remoteUrl: 'https://bitbucket.org/project/repo',
        catalogInfoUrl:
          'https://bitbucket.org/project/repo/src/master/catalog-info.yaml',
      });

      expect(initRepoAndPush).toHaveBeenCalledWith({
        dir: '/tmp/test',
        remoteUrl: 'https://bitbucket.org/project/repo',
        auth: { username: 'fake-user', password: 'fake-token' },
        logger: logger,
      });
    });
  });

  describe('publish: createRemoteInBitbucketServer', () => {
    it('should create repo in bitbucket server', async () => {
      server.use(
        rest.post(
          'https://bitbucket.mycompany.com/rest/api/1.0/projects/project/repos',
          (_, res, ctx) =>
            res(
              ctx.status(201),
              ctx.set('Content-Type', 'application/json'),
              ctx.json({
                links: {
                  self: [
                    {
                      href:
                        'https://bitbucket.mycompany.com/projects/project/repos/repo',
                    },
                  ],
                  clone: [
                    {
                      name: 'http',
                      href: 'https://bitbucket.mycompany.com/scm/project/repo',
                    },
                  ],
                },
              }),
            ),
        ),
      );

      const publisher = await BitbucketPublisher.fromConfig({
        host: 'bitbucket.mycompany.com',
        token: 'fake-token',
      });

      const result = await publisher.publish({
        values: {
          storePath: 'https://bitbucket.mycompany.com/project/repo',
          owner: 'bob',
        },
        directory: '/tmp/test',
        logger: logger,
      });

      expect(result).toEqual({
        remoteUrl: 'https://bitbucket.mycompany.com/scm/project/repo',
        catalogInfoUrl:
          'https://bitbucket.mycompany.com/projects/project/repos/repo/catalog-info.yaml',
      });

      expect(initRepoAndPush).toHaveBeenCalledWith({
        dir: '/tmp/test',
        remoteUrl: 'https://bitbucket.mycompany.com/scm/project/repo',
        auth: { username: 'x-token-auth', password: 'fake-token' },
        logger: logger,
      });
    });
  });
});
