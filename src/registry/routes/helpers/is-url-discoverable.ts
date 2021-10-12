import got from 'got';

export default async function isUrlDiscoverable(
  url: string
): Promise<{ isDiscoverable: boolean }> {
  try {
    const res = await got(url, {
      headers: { accept: 'text/html' }
    });
    const isHtml = !!res.headers['content-type']?.includes('text/html');

    return {
      isDiscoverable: isHtml
    };
  } catch (err) {
    return { isDiscoverable: false };
  }
}
