import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({Key? key}) : super(key: key);

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _tasks = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTasks();
  }

  Future<void> _loadTasks() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _api.getTasks();
      if (mounted) {
        setState(() {
          _tasks = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Tasks'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loading ? null : _loadTasks),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadTasks, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _tasks.isEmpty
                  ? const Center(child: Text('No tasks'))
                  : RefreshIndicator(
                      onRefresh: _loadTasks,
                      child: ListView.builder(
                        itemCount: _tasks.length,
                        itemBuilder: (context, i) {
                          final t = _tasks[i] as Map<String, dynamic>;
                          final title = t['title']?.toString() ?? 'Task';
                          final status = t['status']?.toString() ?? 'PENDING';
                          final dueAt = t['dueAt'];
                          final dueStr = dueAt != null
                              ? DateFormat.yMMMd().add_jm().format(DateTime.tryParse(dueAt.toString()) ?? DateTime.now())
                              : '';
                          return ListTile(
                            leading: Icon(
                              status == 'COMPLETED' ? Icons.check_circle : Icons.radio_button_unchecked,
                              color: status == 'COMPLETED' ? Colors.green : null,
                            ),
                            title: Text(title),
                            subtitle: dueStr.isNotEmpty ? Text(dueStr) : null,
                          );
                        },
                      ),
                    ),
    );
  }
}
