import { Href, Redirect } from 'expo-router';

const dashboardHref = '/dashboard' as Href;

export default function NativeIndexRedirect() {
  return <Redirect href={dashboardHref} />;
}
