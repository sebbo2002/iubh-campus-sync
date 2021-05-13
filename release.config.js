module.exports = {
    'branches': [
        'main',
        {
            'name': 'develop',
            'channel': 'next',
            'prerelease': true
        }
    ],
    'plugins': [
        ['@semantic-release/commit-analyzer', {
            'releaseRules': [
                {'type': 'build', 'scope': 'deps', 'release': 'patch'},
                {'type': 'docs', 'release': 'patch'}
            ]
        }],
        '@semantic-release/release-notes-generator',
        ['@semantic-release/exec', {
            'prepareCmd': 'npm run build'
        }],
        '@semantic-release/changelog',
        'semantic-release-license',
        ['@amanda-mitchell/semantic-release-npm-multiple', {
            'registries': {
                'github': {},
                'public': {}
            }
        }],
        ['@semantic-release/github', {
            'labels': false,
            'assignees': process.env.GH_OWNER
        }],
        ['@semantic-release/git', {
            'assets': ['CHANGELOG.md', 'LICENSE'],
            'message': 'chore(release): :bookmark: ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
        }],
        ['@eclass/semantic-release-docker', {
            'baseImageName': process.env.DOCKER_REGISTRY_IMAGE + '@' + process.env.DOCKER_DIGEST,
            'registries': [
                {
                    'url': 'docker.io',
                    'imageName': process.env.DOCKER_REGISTRY_IMAGE,
                    'user': 'DOCKER_REGISTRY_USERNAME',
                    'password': 'DOCKER_REGISTRY_TOKEN'
                }
            ]
        }],
        ['@eclass/semantic-release-docker', {
            'baseImageName': 'ghcr.io/' + process.env.GH_REPO + '@' + process.env.DOCKER_DIGEST,
            'registries': [
                {
                    'url': 'ghcr.io',
                    'imageName': 'ghcr.io/' + process.env.GH_REPO,
                    'user': 'GITHUB_REGISTRY_USERNAME',
                    'password': 'GITHUB_REGISTRY_TOKEN'
                }
            ]
        }]
    ]
};
