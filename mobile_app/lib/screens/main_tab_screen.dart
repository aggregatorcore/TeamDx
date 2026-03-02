import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'leads_list_screen.dart';
import 'tasks_screen.dart';
import 'profile_screen.dart';

class MainTabScreen extends StatefulWidget {
  const MainTabScreen({Key? key}) : super(key: key);

  @override
  State<MainTabScreen> createState() => _MainTabScreenState();
}

class _MainTabScreenState extends State<MainTabScreen> {
  int _currentIndex = 0;

  final _tabs = const [
    _TabItem(Icons.phone_in_talk, 'Calls', HomeScreen()),
    _TabItem(Icons.people, 'Leads', LeadsListScreen()),
    _TabItem(Icons.task_alt, 'Tasks', TasksScreen()),
    _TabItem(Icons.person, 'Profile', ProfileScreen()),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs.map((t) => t.screen).toList(),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        type: BottomNavigationBarType.fixed,
        items: _tabs
            .asMap()
            .entries
            .map((e) => BottomNavigationBarItem(
                  icon: Icon(e.value.icon),
                  label: e.value.label,
                ))
            .toList(),
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final String label;
  final Widget screen;
  const _TabItem(this.icon, this.label, this.screen);
}
