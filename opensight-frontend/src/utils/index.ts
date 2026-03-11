


export function createPageUrl(pageName: string) {
    // Convert camelCase to kebab-case (e.g., "AdminDashboard" -> "admin-dashboard")
    return '/' + pageName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/ /g, '-');
}