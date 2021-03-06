(() => {
	'use strict';

	const xhr = (() => {
		const xhr = new XMLHttpRequest();

		return (method, url, headers, cb) => {
			if (!cb && typeof headers === 'function') {
				cb = headers;
				headers = null;
			}

			xhr.onreadystatechange = () => {
				if (xhr.readyState === 4) {
					cb(xhr.responseText, xhr.status, xhr);
					return;
				}
			};

			xhr.open(method, url);

			if (headers) {
				Object.keys(headers).forEach(x => {
					xhr.setRequestHeader(x, headers[x]);
				});
			}

			xhr.setRequestHeader('If-Modified-Since', '');
			xhr.send();
		};
	})();

	window.GitHubNotify = (() => {
		const defaults = {
			rootUrl: 'https://api.github.com/',
			oauthToken: '',
			useParticipatingCount: false,
			interval: 60
		};

		const api = {
			settings: {
				get: name => {
					const item = localStorage.getItem(name);

					if (item === null) {
						return {}.hasOwnProperty.call(defaults, name) ? defaults[name] : undefined;
					}

					if (item === 'true' || item === 'false') {
						return item === 'true';
					}

					return item;
				},
				set: localStorage.setItem.bind(localStorage),
				remove: localStorage.removeItem.bind(localStorage),
				reset: localStorage.clear.bind(localStorage)
			}
		};

		api.defaults = defaults;

		return api;
	})();

	window.gitHubNotifCount = cb => {
		const token = window.GitHubNotify.settings.get('oauthToken');
		const opts = {
			Authorization: `token ${token}`
		};
		const query = [];
		if (window.GitHubNotify.settings.get('useParticipatingCount')) {
			query.push('participating=true');
		}
		query.push('per_page=1');

		let url = window.GitHubNotify.settings.get('rootUrl');

		if (!token) {
			cb(new Error('missing token'), null, window.GitHubNotify.defaults.interval);
			return;
		}

		if (/(^(https:\/\/)?(api\.)?github\.com)/.test(url)) {
			url = 'https://api.github.com/notifications';
		} else {
			url += 'api/v3/notifications';
		}

		url += `?${query.join('&')}`;

		xhr('GET', url, opts, (data, status, response) => {
			const interval = Number(response.getResponseHeader('X-Poll-Interval'));
			const linkheader = response.getResponseHeader('Link');

			if (status >= 500) {
				cb(new Error('server error'), null, interval);
				return;
			}

			if (status >= 400) {
				cb(new Error(`client error: ${data}`), null, interval);
				return;
			}

			try {
				data = JSON.parse(data);
			} catch (err) {
				cb(new Error('parse error'), null, interval);
				return;
			}

			if (data) {
				if (linkheader === null) {
					// 0 or 1 pages
					cb(null, data.length, interval);
				} else {
					const lastlink = linkheader.split(', ').find(link => link.endsWith('rel="last"'));
					const pages = Number(lastlink.slice(lastlink.lastIndexOf('page=') + 5, lastlink.lastIndexOf('>')));
					cb(null, pages, interval);
				}
				return;
			}

			cb(new Error('data format error'), null, interval);
			return;
		});
	};
})();
