#!/usr/bin/env python3
"""
API URL可访问性检查脚本
从all-api-hub-backup-2026-04-28.json文件中提取所有accounts的site_url
并检查其可访问性
"""

import json
import requests
import asyncio
import aiohttp
from datetime import datetime
from typing import Dict, List, Tuple
import sys

class URLChecker:
    def __init__(self, json_file_path: str):
        self.json_file_path = json_file_path
        self.results = []
        
    def load_accounts(self) -> List[Dict]:
        """加载JSON文件并提取所有accounts"""
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            accounts = data.get('accounts', {}).get('accounts', [])
            print(f"找到 {len(accounts)} 个账号")
            return accounts
        except Exception as e:
            print(f"加载JSON文件失败: {e}")
            return []
    
    async def check_url_async(self, session: aiohttp.ClientSession, url: str, timeout: int = 10) -> Tuple[str, bool, str, int]:
        """异步检查单个URL的可访问性"""
        try:
            async with session.get(url, timeout=timeout, ssl=False) as response:
                status_code = response.status
                is_accessible = 200 <= status_code < 400
                reason = f"HTTP {status_code}"
                return url, is_accessible, reason, status_code
        except asyncio.TimeoutError:
            return url, False, "请求超时", 0
        except aiohttp.ClientError as e:
            return url, False, f"连接错误: {str(e)}", 0
        except Exception as e:
            return url, False, f"未知错误: {str(e)}", 0
    
    async def check_all_urls(self, accounts: List[Dict]) -> List[Dict]:
        """异步检查所有URL"""
        urls_to_check = []
        account_info = {}
        
        for account in accounts:
            site_url = account.get('site_url', '')
            site_name = account.get('site_name', 'Unknown')
            account_id = account.get('id', 'Unknown')
            
            if site_url:
                urls_to_check.append(site_url)
                account_info[site_url] = {
                    'id': account_id,
                    'site_name': site_name,
                    'site_url': site_url,
                    'health_status': account.get('health', {}).get('status', 'unknown'),
                    'health_reason': account.get('health', {}).get('reason', ''),
                    'disabled': account.get('disabled', False),
                    'exchange_rate': account.get('exchange_rate', 0),
                    'quota': account.get('account_info', {}).get('quota', 0)
                }
        
        print(f"开始检查 {len(urls_to_check)} 个URL...")
        
        connector = aiohttp.TCPConnector(limit=50, limit_per_host=10)
        timeout = aiohttp.ClientTimeout(total=15)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            tasks = [self.check_url_async(session, url) for url in urls_to_check]
            results = await asyncio.gather(*tasks)
        
        # 合并结果
        final_results = []
        for url, is_accessible, reason, status_code in results:
            result = account_info[url].copy()
            result.update({
                'is_accessible': is_accessible,
                'check_reason': reason,
                'status_code': status_code,
                'checked_at': datetime.now().isoformat()
            })
            final_results.append(result)
        
        return final_results
    
    def print_results(self, results: List[Dict]):
        """打印检查结果"""
        print("\n" + "="*80)
        print("API URL可访问性检查结果")
        print("="*80)
        
        accessible_count = 0
        inaccessible_count = 0
        
        for result in results:
            status = "✅ 可访问" if result['is_accessible'] else "❌ 不可访问"
            print(f"\n{status}")
            print(f"站点名称: {result['site_name']}")
            print(f"URL: {result['site_url']}")
            print(f"状态码: {result['status_code']}")
            print(f"检查原因: {result['check_reason']}")
            print(f"健康状态: {result['health_status']} ({result['health_reason']})")
            print(f"是否禁用: {'是' if result['disabled'] else '否'}")
            print(f"汇率: {result['exchange_rate']}")
            print(f"配额: {result['quota']:,}")
            
            if result['is_accessible']:
                accessible_count += 1
            else:
                inaccessible_count += 1
        
        print("\n" + "="*80)
        print(f"总结: {accessible_count} 个可访问, {inaccessible_count} 个不可访问")
        print(f"总共: {len(results)} 个URL")
        print("="*80)
    
    def save_results(self, results: List[Dict], output_file: str = None):
        """保存结果到文件"""
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"url_check_results_{timestamp}.json"
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'total_checked': len(results),
                    'accessible_count': sum(1 for r in results if r['is_accessible']),
                    'inaccessible_count': sum(1 for r in results if not r['is_accessible']),
                    'results': results
                }, f, ensure_ascii=False, indent=2)
            
            print(f"\n结果已保存到: {output_file}")
        except Exception as e:
            print(f"保存结果失败: {e}")
    
    async def run(self):
        """运行检查"""
        print("开始加载账号数据...")
        accounts = self.load_accounts()
        
        if not accounts:
            print("没有找到账号数据")
            return
        
        print("开始检查URL可访问性...")
        results = await self.check_all_urls(accounts)
        
        self.print_results(results)
        self.save_results(results)
        
        return results

def main():
    if len(sys.argv) != 2:
        print("用法: python check_api_urls.py <json_file_path>")
        print("示例: python check_api_urls.py /Users/sunlice/Downloads/all-api-hub-backup-2026-04-28.json")
        sys.exit(1)
    
    json_file_path = sys.argv[1]
    checker = URLChecker(json_file_path)
    
    try:
        asyncio.run(checker.run())
    except KeyboardInterrupt:
        print("\n检查被用户中断")
    except Exception as e:
        print(f"运行时错误: {e}")

if __name__ == "__main__":
    main()
